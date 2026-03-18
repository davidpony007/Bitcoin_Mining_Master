#!/usr/bin/env python3
"""Deploy system field changes to production server."""
import paramiko
import os

HOST = '47.79.232.189'
USER = 'root'
PASS = 'WHfe2c82a2e5b8e2a3'
LOCAL_BASE = '/Users/a123456/Engineering_Folder/Bitcoin_Mining_Master'
REMOTE_BASE = '/root/bitcoin-docker'

FILES = [
    ('backend/src/controllers/authController.js', 'backend/src/controllers/authController.js'),
    ('backend/src/routes/adminRoutes.js',          'backend/src/routes/adminRoutes.js'),
    ('backend/src/models/userInformation.js',      'backend/src/models/userInformation.js'),
]

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASS, timeout=30)

sftp = client.open_sftp()
for local_rel, remote_rel in FILES:
    local_path = os.path.join(LOCAL_BASE, local_rel)
    remote_path = f'{REMOTE_BASE}/{remote_rel}'
    print(f'Uploading {local_rel} → {remote_path}')
    sftp.put(local_path, remote_path)
    print(f'  OK')
sftp.close()

print('\nRestarting backend container...')
_, stdout, stderr = client.exec_command('docker restart bitcoin_backend_prod')
exit_code = stdout.channel.recv_exit_status()
print(f'  Exit code: {exit_code}')
print(f'  stdout: {stdout.read().decode().strip()}')
err = stderr.read().decode().strip()
if err:
    print(f'  stderr: {err}')

client.close()
print('\nBackend deployment complete.')
