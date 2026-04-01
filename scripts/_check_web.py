#!/usr/bin/env python3
import paramiko

HOST, USER, PASS = '47.79.232.189', 'root', 'WHfe2c82a2e5b8e2a3'
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASS, timeout=30)

def run(cmd):
    _, o, e = c.exec_command(cmd, timeout=15)
    o.channel.recv_exit_status()
    return o.read().decode().strip()

# Check the web frontend container - what path does it serve from?
print('=== web container mounts ===')
print(run('docker inspect bitcoin_web_prod --format "{{json .Mounts}}" | python3 -c "import sys,json; mounts=json.load(sys.stdin); [print(m.get(\'Type\'), m.get(\'Source\',\'\')[:60], \'->\', m.get(\'Destination\',\'\')) for m in mounts]"'))

print('\n=== nginx config in web container ===')
print(run('docker exec bitcoin_web_prod cat /etc/nginx/conf.d/default.conf 2>/dev/null || docker exec bitcoin_web_prod cat /etc/nginx/nginx.conf | grep -A5 root | head -20'))

print('\n=== files served by web container ===')
print(run('docker exec bitcoin_web_prod ls /usr/share/nginx/html/ 2>/dev/null || docker exec bitcoin_web_prod ls /app/dist/ 2>/dev/null || echo "unknown path"'))

print('\n=== assets in server dist folder ===')
print(run('ls /root/bitcoin-docker/web_frontend/dist/assets/'))

print('\n=== assets in web container html ===')
print(run('docker exec bitcoin_web_prod ls /usr/share/nginx/html/assets/ 2>/dev/null | head -10'))

c.close()
