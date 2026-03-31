#!/usr/bin/env python3
"""Deploy backend fixes and frontend build to production server."""
import paramiko
import os
import sys

HOST = '47.79.232.189'
USER = 'root'
PASS = 'WHfe2c82a2e5b8e2a3'

BASE_LOCAL = '/Users/a123456/Engineering_Folder/Bitcoin_Mining_Master'
LOCAL_DIST = f'{BASE_LOCAL}/web_frontend/dist'
REMOTE_DIST = '/root/bitcoin-docker/web_frontend/dist'

BACKEND_FILES = [
    ('backend/src/middleware/auth.js',    '/root/bitcoin-docker/backend/src/middleware/auth.js'),
    ('backend/src/routes/adminRoutes.js', '/root/bitcoin-docker/backend/src/routes/adminRoutes.js'),
]


def upload_directory(sftp, local_dir, remote_dir):
    try:
        sftp.stat(remote_dir)
    except FileNotFoundError:
        sftp.mkdir(remote_dir)

    for item in os.listdir(local_dir):
        local_path = os.path.join(local_dir, item)
        remote_path = f'{remote_dir}/{item}'
        if os.path.isdir(local_path):
            upload_directory(sftp, local_path, remote_path)
        else:
            sftp.put(local_path, remote_path)
            print(f'  uploaded: {os.path.basename(local_path)}')


def run(client, cmd):
    _, stdout, stderr = client.exec_command(cmd)
    rc = stdout.channel.recv_exit_status()
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    if out:
        print(f'  {out}')
    if err:
        print(f'  [stderr] {err}')
    return rc


print(f'Connecting to {HOST} ...')
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASS, timeout=30)
sftp = client.open_sftp()

# ─── 1. Deploy backend files ───────────────────────────────────────────────
print('\n=== Deploying backend files ===')
for local_rel, remote_path in BACKEND_FILES:
    local_path = os.path.join(BASE_LOCAL, local_rel)
    print(f'  uploading {local_rel}')
    sftp.put(local_path, remote_path)

print('Restarting backend container...')
rc = run(client, 'docker restart bitcoin_backend_prod')
print(f'  exit code: {rc}')

# Wait for backend to be ready
import time
time.sleep(5)
rc2 = run(client, 'docker exec bitcoin_backend_prod curl -s http://localhost:8888/api/health || echo "health endpoint not found (ok)"')

# ─── 2. Deploy frontend dist ───────────────────────────────────────────────
print('\n=== Deploying frontend dist ===')
REMOTE_STAGE = '/tmp/web_dist_deploy'
run(client, f'rm -rf {REMOTE_STAGE} && mkdir -p {REMOTE_STAGE}/assets')
upload_directory(sftp, LOCAL_DIST, REMOTE_STAGE)

print('Copying into container /usr/share/nginx/html ...')
run(client, 'docker exec bitcoin_web_prod sh -c "rm -rf /usr/share/nginx/html/assets && rm -f /usr/share/nginx/html/index.html"')
rc2 = run(client, f'docker cp {REMOTE_STAGE}/. bitcoin_web_prod:/usr/share/nginx/html/')
print(f'  docker cp exit code: {rc2}')
run(client, f'rm -rf {REMOTE_STAGE}')

print('Reloading nginx in frontend container...')
rc = run(client, 'docker exec bitcoin_web_prod nginx -s reload')
print(f'  exit code: {rc}')

sftp.close()
client.close()

print('\n✅ Deployment complete!')
print('   - Backend: auth.js (401 for expired tokens) + adminRoutes.js (user detail + BTC adjust)')
print('   - Frontend: new Users page with detail drawer & BTC adjust modal')
print('\nNext: open https://smartearningtool.top/data-system/ in browser,')
print('clear localStorage (DevTools → Application → Local Storage → delete token),')
print('re-login as admin.')
