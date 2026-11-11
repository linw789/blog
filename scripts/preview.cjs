const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname,'../dist');
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.xml':'application/xml','.jpg':'image/jpeg','.webp':'image/webp'};
http.createServer(async(req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let file = path.resolve(root,`.${pathname}`);
    if (!file.startsWith(root + path.sep) && file !== root) {res.writeHead(403);res.end();return;}
    if ((await fs.stat(file)).isDirectory()) file = path.join(file,'index.html');
    const data = await fs.readFile(file);
    res.writeHead(200,{'Content-Type':types[path.extname(file)] || 'application/octet-stream'});res.end(data);
  } catch {res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
}).listen(4321,'127.0.0.1',() => console.log('Local: http://127.0.0.1:4321'));
