# Read-only host/live-app measurements. Stop signals are handled by the local runner.
import json,time,pathlib,urllib.request
cg=pathlib.Path('/sys/fs/cgroup/tasktracker.slice/tasktracker-staging.slice')
for sample in range(170):
    started=time.monotonic()
    mem={line.split(':')[0]:int(line.split()[1]) for line in pathlib.Path('/proc/meminfo').read_text().splitlines()}
    events=dict(line.split() for line in (cg/'memory.events').read_text().splitlines())
    row={'sample':sample,'time':time.time(),'availableMiB':round(mem['MemAvailable']/1024,1),'stagingMiB':round(int((cg/'memory.current').read_text())/1048576,1),'oom':int(events['oom']),'oomKill':int(events['oom_kill']),'memoryMaxEvents':int(events['max'])}
    begin=time.monotonic()
    try:
        with urllib.request.urlopen('http://127.0.0.1:3000/login',timeout=3) as r: row['liveStatus']=r.status;r.read()
        row['liveMs']=round((time.monotonic()-begin)*1000,2)
    except Exception:row['liveStatus']=0;row['liveMs']=round((time.monotonic()-begin)*1000,2)
    print(json.dumps(row),flush=True)
    time.sleep(max(0,2-(time.monotonic()-started)))
