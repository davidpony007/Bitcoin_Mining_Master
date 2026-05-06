#!/usr/bin/env python3
"""
运行此脚本获取 AdMob API 的 Refresh Token
用法：python3 get_admob_token.py
需要：pip install google-auth-oauthlib
"""

import json
import os
from google_auth_oauthlib.flow import InstalledAppFlow

CLIENT_ID     = os.environ.get("ADMOB_CLIENT_ID", "")
CLIENT_SECRET = os.environ.get("ADMOB_CLIENT_SECRET", "")
if not CLIENT_ID or not CLIENT_SECRET:
    raise SystemExit("请先设置环境变量 ADMOB_CLIENT_ID 和 ADMOB_CLIENT_SECRET\n"
                     "  export ADMOB_CLIENT_ID='your-client-id'\n"
                     "  export ADMOB_CLIENT_SECRET='your-client-secret'")
SCOPES        = ["https://www.googleapis.com/auth/admob.readonly"]

client_config = {
    "installed": {
        "client_id":     CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "redirect_uris": ["http://localhost", "urn:ietf:wg:oauth:2.0:oob"],
        "auth_uri":      "https://accounts.google.com/o/oauth2/auth",
        "token_uri":     "https://oauth2.googleapis.com/token",
    }
}

print("正在打开浏览器进行 Google 授权...")
print("请用你的 AdMob 账号（Google 账号）登录并授权。\n")

flow = InstalledAppFlow.from_client_config(client_config, scopes=SCOPES)
creds = flow.run_local_server(port=8085, open_browser=True)

print("\n✅ 授权成功！")
print(f"\nRefresh Token:\n{creds.refresh_token}")
print("\n请将以下内容更新到服务器 /root/bitcoin-docker/.env 文件中：")
print(f"ADMOB_OAUTH_REFRESH_TOKEN={creds.refresh_token}")
