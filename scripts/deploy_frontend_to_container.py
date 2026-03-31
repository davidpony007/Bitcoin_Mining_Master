#!/usr/bin/env python3
"""Copy new dist into the web container directly via docker cp."""
import paramiko, os

HOST, USER, PASS = '47.79.232.189', 'root', 'WHfe2c82a2e5b8e2a3'
LOCAL_DIST = '/Users/a123456/Engineering_Folder/Bitcoin_Mining_Master/web_frontend/dist'

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASS, timeout=30)
sftp = c.open_sftp()

def run(cmd):
    _, o, e = c.exec_command(cmd, timeout=30)
    rc = o.channel.recv_exit_status()
    return o.read().decode().strip(), e.read().decode().strip(), rc

REMOTE_STAGE = '/tmp/web_dist_stage'

# ── 1. Create staging dir on server ──────────────────────────────────────────
run(f'rm -rf {REMOTE_STAGE} && mkdir -p {REMOTE_STAGE}/assets')

# ── 2. Upload dist files to staging ──────────────────────────────────────────
def upload_dir(sftp, local_dir, remote_dir):
    for item in os.listdir(local_dir):
        lp = os.path.join(local_dir, item)
        rp = f'{remote_dir}/{item}'
        if os.path.isdir(lp):
            try: sftp.stat(rp)
            except FileNotFoundError: sftp.mkdir(rp)
            upload_dir(sftp, lp, rp)
        else:
            sftp.put(lp, rp)
            print(f'  staged: {item}')

print('Uploading dist to staging...')
upload_dir(sftp, LOCAL_DIST, REMOTE_STAGE)

# ── 3. Copy from staging into container ─────────────────────────────────────
print('\nCopying into container /usr/share/nginx/html ...')
# Clear old files first, then copy new ones
out, err, rc = run('docker exec bitcoin_web_prod sh -c "rm -rf /usr/share/nginx/html/assets && rm -f /usr/share/nginx/html/index.html"')
print(f'  clear old: rc={rc}')

out, err, rc = run(f'docker cp {REMOTE_STAGE}/. bitcoin_web_prod:/usr/share/nginx/html/')
print(f'  docker cp: rc={rc}', err[:100] if err else '')

# ── 4. Verify ────────────────────────────────────────────────────────────────
out, _, _ = run('docker exec bitcoin_web_prod ls /usr/share/nginx/html/assets/')
print('\nNew files in container:')
for f in out.split('\n'):
    print(f'  {f}')

# ── 5. Reload nginx (no restart needed, just reload config) ──────────────────
out, err, rc = run('docker exec bitcoin_web_prod nginx -s reload')
print(f'\nnginx reload: rc={rc}', out or err or 'ok')

# ── 6. Cleanup staging ───────────────────────────────────────────────────────
run(f'rm -rf {REMOTE_STAGE}')

sftp.close()
c.close()
print('\n✅ Frontend updated in container! Hard refresh (Cmd+Shift+R) in browser to see changes.')
