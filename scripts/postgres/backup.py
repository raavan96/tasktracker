#!/usr/bin/python3
"""Root-only backup, using one PostgreSQL snapshot and a short attachment write lock."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import selectors
import shutil
import subprocess
import sys
from urllib.parse import urlsplit

os.umask(0o077)
def digest_file(path):
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()

env_file = Path(sys.argv[1] if len(sys.argv) > 1 else '/etc/tasktracker-local.env')
config = dict(line.split('=', 1) for line in env_file.read_text().splitlines() if '=' in line and not line.startswith('#'))
url = urlsplit(config['DATABASE_URL'])
database = url.path.lstrip('/')
if url.hostname != '127.0.0.1' or url.port != 55433 or not re.fullmatch(r'tasktracker_[a-z0-9_]+', database):
    raise SystemExit('Unexpected database target')
attachments = Path(config['ATTACHMENTS_DIR']).resolve()
if not str(attachments).startswith('/var/lib/tasktracker-'):
    raise SystemExit('Unexpected attachment root')
root = Path('/var/backups/tasktracker')
root.mkdir(mode=0o700, parents=True, exist_ok=True)
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
target = root / ('.partial-' + stamp)
target.mkdir(mode=0o700)
pg = ['runuser', '-u', 'postgres', '--']
connection = ['-h', '/var/lib/pgsql/tasktracker-staging/socket', '-p', '55433', '-d', database]
session = subprocess.Popen(pg + ['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'] + connection,
                           stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
def query(sql):
    session.stdin.write(sql + '\n')
    session.stdin.flush()
    ready = selectors.DefaultSelector()
    ready.register(session.stdout, selectors.EVENT_READ)
    if not ready.select(40):
        raise RuntimeError('Snapshot session timed out')
    ready.close()
    result = session.stdout.readline().strip()
    if not result:
        raise RuntimeError('Snapshot session failed')
    return result
try:
    snapshot = query("BEGIN ISOLATION LEVEL REPEATABLE READ; SET LOCAL lock_timeout='10s'; SET LOCAL idle_in_transaction_session_timeout='180s'; LOCK TABLE public.task_attachments IN SHARE MODE; SELECT pg_export_snapshot();")
    if not re.fullmatch(r'[0-9A-F-]+', snapshot):
        raise RuntimeError('Invalid snapshot')
    files = json.loads(query("SELECT coalesce(json_agg(json_build_object('path',storage_path,'size',size)), '[]'::json) FROM task_attachments;"))
    with (target / 'database.dump').open('xb') as output:
        subprocess.run(pg + ['pg_dump', '-Fc', '--snapshot=' + snapshot] + connection, stdout=output, stderr=subprocess.DEVNULL, check=True, timeout=120)
    hashes = []
    for item in files:
        relative = item['path']
        if not re.fullmatch(r'[a-f0-9-]{36}/[a-f0-9-]{36}/[a-zA-Z0-9._-]{1,150}', relative) or any(p in ('.','..') for p in relative.split('/')):
            raise RuntimeError('Unsafe attachment path')
        source = (attachments / relative).resolve(strict=True)
        if attachments not in source.parents:
            raise RuntimeError('Attachment escaped storage root')
        destination = target / 'attachments' / relative
        destination.parent.mkdir(parents=True, mode=0o700, exist_ok=True)
        shutil.copyfile(source, destination)
        if destination.stat().st_size != int(item['size']):
            raise RuntimeError('Attachment size mismatch')
        hashes.append({'path':relative, 'size':destination.stat().st_size, 'sha256':digest_file(destination)})
    query("COMMIT; SELECT 'committed';")
    with (target / 'roles.sql').open('xb') as output:
        subprocess.run(pg + ['pg_dumpall','-h','/var/lib/pgsql/tasktracker-staging/socket','-p','55433','--roles-only'], stdout=output, stderr=subprocess.DEVNULL, check=True, timeout=30)
    recovery = target / 'configuration'
    recovery.mkdir(mode=0o700)
    paths = [env_file, Path('/etc/systemd/system/tasktracker.service'), Path('/etc/systemd/system/tasktracker-automation.service'), Path('/etc/systemd/system/tasktracker-staging-db.service'), Path('/etc/nginx/conf.d/tasktracker.conf')]
    for path in paths:
        shutil.copyfile(path, recovery / path.name)
    digest = digest_file(target / 'database.dump')
    (target / 'manifest.json').write_text(json.dumps({'database':database,'createdAt':stamp,'databaseSha256':digest,'attachments':hashes,'snapshotConsistent':True}, indent=2))
    final = root / stamp
    target.rename(final)
    # Keep 28 successful backups (seven days at the configured six-hour interval).
    completed = sorted(p for p in root.iterdir() if p.is_dir() and re.fullmatch(r'\d{8}T\d{12}Z', p.name) and (p/'manifest.json').is_file())
    for old in completed[:-28]:
        shutil.rmtree(old)
    print(json.dumps({'backup':str(final),'database':database,'files':len(files),'sha256':digest}))
finally:
    if session.poll() is None:
        session.stdin.close()
        try:
            session.wait(timeout=5)
        except subprocess.TimeoutExpired:
            session.terminate()
            session.wait(timeout=5)
