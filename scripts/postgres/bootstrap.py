# Run from the app directory: python3 scripts/postgres/bootstrap.py
import getpass, json, subprocess, sys
email=input('Staging admin email: ').strip()
name=input('Full name: ').strip()
password=getpass.getpass('Staging password (8–256 characters): ')
if password != getpass.getpass('Confirm password: '):
    raise SystemExit('Passwords do not match.')
subprocess.run(['node','--env-file='+ (sys.argv[1] if len(sys.argv)>1 else '.env.staging'),'scripts/postgres/bootstrap.mjs'],input=json.dumps({'email':email,'fullName':name,'password':password}),text=True,check=True)
