/**
 * AdMob OAuth2 重新授权脚本
 * 运行: node scripts/admob_reauth.js
 * 完成后会输出新的 ADMOB_OAUTH_REFRESH_TOKEN，将其更新到服务器 .env 即可
 */

'use strict';

const http = require('http');
const { OAuth2Client } = require('/Users/a123456/Engineering_Folder/Bitcoin_Mining_Master/backend/node_modules/google-auth-library');

// ── 从服务器 .env 复制过来的 OAuth2 凭证 ──────────────────────────────────────
// 使用前请先设置环境变量，或直接在此处填入（勿提交明文凭证）：
//   export ADMOB_OAUTH_CLIENT_ID=xxxx
//   export ADMOB_OAUTH_CLIENT_SECRET=xxxx
const CLIENT_ID     = process.env.ADMOB_OAUTH_CLIENT_ID     || '';
const CLIENT_SECRET = process.env.ADMOB_OAUTH_CLIENT_SECRET || '';
const REDIRECT_URI  = 'http://localhost:3333/oauth2callback';
const SCOPES        = ['https://www.googleapis.com/auth/admob.readonly'];

const oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// 生成授权 URL
const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent',          // 强制弹出同意页，确保返回 refresh_token
});

console.log('\n====================================================');
console.log('请在浏览器中打开以下 URL 完成 AdMob 授权：');
console.log('\n' + authUrl + '\n');
console.log('授权完成后会自动跳转回本地，脚本将打印新的 refresh_token。');
console.log('====================================================\n');

// 启动本地回调服务器
const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/oauth2callback')) {
    res.end('not found');
    return;
  }

  const url  = new URL(req.url, 'http://localhost:3333');
  const code = url.searchParams.get('code');

  if (!code) {
    res.writeHead(400);
    res.end('缺少 code 参数');
    return;
  }

  try {
    const { tokens } = await oAuth2Client.getToken(code);

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<h2>授权成功！请关闭此页面，回到终端查看新的 refresh_token。</h2>`);

    console.log('\n✅ 授权成功！新的 refresh_token：\n');
    console.log(tokens.refresh_token);
    console.log('\n请将以下内容更新到服务器 /root/Bitcoin_Mining_Master/.env：');
    console.log(`\nADMOB_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    console.log('====================================================');
    console.log('完整 tokens（access_token 可忽略，过期后自动刷新）:');
    console.log(JSON.stringify(tokens, null, 2));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<h2>授权失败：${err.message}</h2>`);
    console.error('\n❌ 换取 token 失败:', err.message);
  } finally {
    server.close();
  }
});

server.listen(3333, () => {
  console.log('本地回调服务器已启动，等待 Google 重定向... (端口 3333)');
});
