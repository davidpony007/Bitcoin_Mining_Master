#!/usr/bin/env python3
"""Deploy web frontend build to production server."""
import paramiko
import os
import tarfile
import io

HOST = '47.79.232.189'
USER = 'root'
PASS = 'WHfe2c82a2e5b8e2a3'
LOCAL_DIST = '/Users/a123456/Engineering_Folder/Bitcoin_Mining_Master/web_frontend/dist'
REMOTE_DIST = '/root/bitcoin-docker/web_frontend/dist'

def upload_directory(sftp, local_dir, remote_dir):
    """Recursively upload a directory via SFTP."""
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

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASS, timeout=30)

sftp = client.open_sftp()
print(f'Uploading dist to {REMOTE_DIST} ...')
upload_directory(sftp, LOCAL_DIST, REMOTE_DIST)
sftp.close()
print('Upload complete.')

print('Restarting frontend container...')
_, stdout, stderr = client.exec_command('docker restart bitcoin_web_prod')
exit_code = stdout.channel.recv_exit_status()
print(f'  Exit code: {exit_code}')
print(f'  stdout: {stdout.read().decode().strip()}')
err = stderr.read().decode().strip()
if err:
    print(f'  stderr: {err}')

client.close()
print('Frontend deployment complete.')
