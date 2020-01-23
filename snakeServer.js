const {Server} = require('net');
const fs = require('fs');

let visitorCount = 0;
const STATIC_FOLDER = `${__dirname}/public`;
const CONTENT_TYPE = {
  js: 'application/javascript',
  css: 'text/css',
  json: 'application/json',
  gif: 'image/gif',
  html: 'text/html',
};

class Response {
  constructor() {
    this.statusCode = 404;
    this.headers = [{key: 'Content-Length', value: 0}];
  }
  setHeader(key, value) {
    let header = this.headers.find(h => h.key === key);
    if (header) header.value = value;
    else this.headers.push({key, value});
  }
  generateHeadersText() {
    const lines = this.headers.map(header => `${header.key}:${header.value}`);
    return lines.join('\r\n');
  }
  writeTo(writable) {
    writable.write(`HTTP/1.1 ${this.statusCode}\r\n`);
    writable.write(this.generateHeadersText());
    writable.write('\r\n\r\n');
    this.body && writable.write(this.body);
  }
}

const serveStaticPage = req => {
  const path = `${STATIC_FOLDER}${req.url}`;
  console.log('===============>', path);
  const stat = fs.existsSync(path) && fs.statSync(path);
  if (!stat || !stat.isFile()) return new Response();
  const [, extension] = path.match(/.*\.(.*)$/);
  const contentType = CONTENT_TYPE[extension];
  const content = fs.readFileSync(path);
  const res = new Response();
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', content.length);
  res.statusCode = 200;
  res.body = content;
  return res;
};

const serveHomePage = req => {
  console.log('===============>', `.${req.url}index.html`);
  visitorCount++;
  const html = fs.readFileSync(`.${req.url}index.html`);
  const res = new Response();
  res.setHeader('Content-Type', CONTENT_TYPE.html);
  res.setHeader('Content-Length', html.length);
  res.statusCode = 200;
  res.body = html;
  return res;
};

const findHandler = req => {
  if (req.method === 'GET' && req.url === '/') return serveHomePage;
  if (req.method === 'GET') return serveStaticPage;
  return () => new Response();
};

const collectHeadersAndBody = (result, line) => {
  if (line === '') {
    result.body = '';
    return result;
  }
  if ('body' in result) {
    result.body += line;
    return result;
  }
  const [key, value] = line.split(':');
  result.headers[key] = value;
  return result;
};

class Request {
  constructor(method, url, headers, body) {
    this.method = method;
    this.url = url;
    this.headers = headers;
    this.body = body;
  }
  static parse(text) {
    const [requestLine, ...headersAndBody] = text.split('\r\n');
    const [method, url, protocol] = requestLine.split(' ');
    const {headers, body} = headersAndBody.reduce(collectHeadersAndBody, {
      headers: {}
    });
    const req = new Request(method, url, headers, body);
    return req;
  }
}

const handleConnection = socket => {
  const remote = `${socket.remoteAddress}: ${socket.remotePort}`;
  console.warn('new Connection', remote);
  socket.setEncoding('utf8');
  socket.on('close', hadError => {
    console.warn(`${remote} closed ${hadError ? 'with error' : ''}`);
  });
  socket.on('end', () => console.warn(`${remote} ended`));
  socket.on('error', err => console.error('socket error', err));

  socket.on('data', text => {
    console.warn(`${remote} data:\n`);
    const req = Request.parse(text);
    const handler = findHandler(req);
    const res = handler(req);
    res.writeTo(socket);
  });
};

const main = () => {
  const server = new Server();
  server.on('error', err => console.warn('server error', err));
  server.on('listening', () => {
    console.warn('started listening on', server.address());
  });
  server.on('connection', handleConnection);
  server.listen(4000);
};

main();
