#!/usr/bin/env python3
"""Deploy backend files into running container via docker cp."""
import paramiko, time

HOST, USER, PASS = '47.79.232.189', 'root', 'WHfe2c82a2e5b8e2a3'
BASE_LOCAL = '/Users/a123456/Engineering_Folder/Bitcoin_Mining_Master'

FILES = [
    ('backend/src/middleware/auth.js',    '/app/src/middleware/auth.js'),
    ('backend/src/routes/adminRoutes.js', '/app/src/routes/adminRoutes.js'),
]

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASS, timeout=30)
sftp = c.open_sftp()

def run(cmd):
    _, o, e = c.exec_command(cmd, timeout=30)
    rc = o.channel.recv_exit_status()
    return o.read().decode().strip(), e.read().decode().strip(), rc

# Stage to host then docker cp into container
STAGE = '/tmp/backend_stage'
run(f'mkdir -p {STAGE}/src/middleware {STAGE}/src/routes')

print('Uploading backend files...')
for local_rel, _ in FILES:
    local_path = f'{BASE_LOCAL}/{local_rel}'
    remote_stage = f'{STAGE}/{local_rel[len("backend/"):]}'
    sftp.put(local_path, remote_stage)
    print(f'  staged: {local_rel}')

print('Copying into container...')
for _, container_path in FILES:
    local_rel = container_path.lstrip('/')
    stage_path = f'{STAGE}/{"/".join(container_path.split("/")[2:])}'  
    # Use direct docker cp from staged location
    _, err, rc = run(f'docker cp {STAGE}/src/{container_path.split("/src/")[1]} bitcoin_backend_prod:{container_path}')
    print(f'  cp {container_path}: rc={rc}', err[:60] if err else '')

print('Restarting backend container...')
_, _, rc = run('docker restart bitcoin_backend_prod')
print(f'  exit code: {rc}')

time.sleep(6)
out, _, _ = run('docker ps --filter name=bitcoin_backend_prod --format "{{.Status}}"')
print(f'  status: {out}')

run(f'rm -rf {STAGE}')
sftp.close()
c.close()
print('✅ Backend deployed.')
