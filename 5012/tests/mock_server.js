// Local mock HTTP server for SDK tests
const http = require('http');

const PORT = 18800;
const server = http.createServer((req, res) => {
  const url = req.url || '/';
  console.log(`[mock-server] ${req.method} ${url}`);

  if (url === '/get') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ url: url, method: 'GET', hello: 'world' }));
  } else if (url === '/post') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ url: url, method: 'POST', body: body }));
    });
  } else if (url.startsWith('/status/')) {
    const code = parseInt(url.split('/')[2], 10);
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code: code }));
  } else if (url === '/flaky') {
    // Return 500 the first 2 times, 200 the 3rd - need persistent counter
    if (!global.flakyCount) global.flakyCount = 0;
    global.flakyCount++;
    if (global.flakyCount < 3) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 500, attempt: global.flakyCount }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 200, attempt: global.flakyCount, ok: true }));
    }
  } else if (url === '/always500') {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code: 500 }));
  } else if (url.startsWith('/delay')) {
    // /delay?ms=3000 - delay then 200
    const ms = parseInt(new URL(url, 'http://localhost').searchParams.get('ms') || '0', 10);
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ delayed: ms }));
    }, ms);
  } else if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ healthy: true }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code: 404, message: 'Not Found' }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[mock-server] listening on http://127.0.0.1:${PORT}`);
});
