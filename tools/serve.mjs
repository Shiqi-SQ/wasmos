#!/usr/bin/env node
// 开发服务器。存在的唯一理由是 COOP/COEP 两个响应头：
// CheerpX 用 SharedArrayBuffer 在 Web Worker 之间共享 VM 内存，
// 而浏览器只对 cross-origin isolated 的页面开放 SAB(Spectre 之后的限制)。
// 少了这两个头，CheerpX 会在 Linux.create() 处直接抛错。
// localhost 下可以免 HTTPS,部署到真实域名时必须上 HTTPS。
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'public');
const PORT = Number(process.env.PORT) || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.ext2': 'application/octet-stream',
};

createServer(async (req, res) => {
  // 这两个头是整个文件的重点
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  // 允许本站资源被 cross-origin isolated 页面加载
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  // normalize 之后再校验前缀,挡掉 ../ 穿越
  let filePath = normalize(join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    let info = await stat(filePath);
    if (info.isDirectory()) {
      filePath = join(filePath, 'index.html');
      info = await stat(filePath);
    }
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-cache',
    });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 Not Found');
  }
}).listen(PORT, () => {
  console.log(`wasmos → http://localhost:${PORT}`);
  console.log(`根目录 ${ROOT}`);
  console.log('COOP/COEP 已启用 (SharedArrayBuffer 可用)');
});
