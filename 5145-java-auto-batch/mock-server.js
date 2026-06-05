const http = require('http');
const url = require('url');

let received = [];

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const parsed = url.parse(req.url, true);
  if (req.method === 'GET' && parsed.pathname === '/health') {
    res.end(JSON.stringify({ status: 'ok' }));
  } else if (req.method === 'GET' && parsed.pathname === '/source') {
    // Return sample data with null, empty string, whitespace, oversized
    res.end(JSON.stringify({
      data: [
        { id: '1', name: '  Alice  ', city: 'Beijing', age: 30, note: 'hello' },
        { id: '2', name: 'bob', city: '', age: 25, note: null },
        { id: '3', name: 'Carol', city: '  ', age: 0, note: 'this is a very long string that exceeds typical length limits and should be truncated by the truncation handler' },
        { id: '4', name: null, city: 'Shanghai', age: -5, note: '' },
        { id: '5', name: 'Eve', city: 'Guangzhou', age: 200, note: 'normal' }
      ],
      nextPage: ''
    }));
  } else if (req.method === 'POST' && parsed.pathname === '/target') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const records = JSON.parse(body);
        received.push(...records);
        res.end(JSON.stringify({ ok: true, count: records.length }));
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  } else if (req.method === 'GET' && parsed.pathname === '/received') {
    res.end(JSON.stringify({ count: received.length, data: received }));
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'not found' }));
  }
});

server.listen(8745, '127.0.0.1', () => {
  console.log('mock server listening on 127.0.0.1:8745');
});
