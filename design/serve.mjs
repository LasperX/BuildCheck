// เซิร์ฟเวอร์ไฟล์นิ่งสำหรับเปิดต้นแบบ (ไม่ต้องติดตั้งอะไรเพิ่ม)
// วิธีใช้: node design/serve.mjs แล้วเปิด http://localhost:4173
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'prototype');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml' };
const port = Number(process.env.PORT) || 4173;

createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const rel = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = normalize(join(root, rel));
  if (file !== root && !file.startsWith(root + sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('ไม่พบไฟล์');
  }
}).listen(port, '127.0.0.1', () => console.log(`BuildCheck prototype: http://localhost:${port}`));
