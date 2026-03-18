#!/usr/bin/env python3
"""Verify deployment - check DB system field and backend container status."""
import paramiko

HOST = '47.79.232.189'
USER = 'root'
PASS = 'WHfe2c82a2e5b8e2a3'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASS, timeout=30)

def run(cmd):
    _, out, err = client.exec_command(cmd)
    out.channel.recv_exit_status()
    return out.read().decode().strip()

# Check container status
print('=== Container Status ===')
print(run("docker ps --filter 'name=bitcoin_backend_prod' --filter 'name=bitcoin_web_prod' --format 'table {{.Names}}\t{{.Status}}'"))

# Check system field in DB
print('\n=== DB system column ===')
print(run("docker exec bitcoin_mysql_prod mysql -uroot -pBitcoin_MySQL_Root_2026!Secure bitcoin_mining_master -e \"SHOW COLUMNS FROM user_information LIKE 'system'\" 2>/dev/null"))

# Check backend logs for errors
print('\n=== Backend recent logs (last 5 lines) ===')
print(run("docker logs --tail 5 bitcoin_backend_prod"))

client.close()
