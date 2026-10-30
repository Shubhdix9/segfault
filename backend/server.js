import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const maxFileBytes = 20 * 1024 * 1024;
const maxJsonBytes = 1024 * 1024;
const uploadLimit = 20;
const uploadWindowMs = 10 * 60 * 1000;

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function readBody(request, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        tooLarge = true;
        chunks.length = 0;
      } else if (!tooLarge) {
        chunks.push(chunk);
      }
    });
    request.on('end', () => {
      if (tooLarge) {
        reject(Object.assign(new Error('Request body is too large.'), { status: 413 }));
      } else {
        resolve(Buffer.concat(chunks));
      }
    });
    request.on('error', reject);
  });
}

function normalizeFileName(rawName) {
  let decodedName = rawName;
  try {
    decodedName = decodeURIComponent(rawName);
  } catch {
    throw Object.assign(new Error('File name is not valid URL encoding.'), { status: 400 });
  }
  return basename(decodedName).replace(/[^\w.-]/g, '_').slice(0, 120) || 'receipt';
}

function normalizeTitle(rawTitle) {
  return String(rawTitle || 'Campaign').replace(/[^\w.-]/g, '_').slice(0, 80) || 'Campaign';
}

export function createPinataServer({
  port = Number(process.env.PORT || 3001),
  jwt = process.env.PINATA_JWT || '',
  mode = process.env.PINATA_MODE || 'pinata',
  frontendOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  nodeEnv = process.env.NODE_ENV || 'development',
  fetchImpl = fetch,
} = {}) {
  if (!['pinata', 'mock'].includes(mode)) throw new Error('PINATA_MODE must be "pinata" or "mock".');
  if (mode === 'mock' && nodeEnv === 'production') {
    throw new Error('Mock IPFS storage cannot run in production.');
  }

  const allowedOrigins = new Set(frontendOrigins);
  const uploadAttempts = new Map();
  const mockStorage = new Map();

  function isRateLimited(request) {
    const now = Date.now();
    const address = request.socket.remoteAddress || 'unknown';
    const recentAttempts = (uploadAttempts.get(address) || [])
      .filter((timestamp) => now - timestamp < uploadWindowMs);
    if (recentAttempts.length >= uploadLimit) {
      uploadAttempts.set(address, recentAttempts);
      return true;
    }
    recentAttempts.push(now);
    uploadAttempts.set(address, recentAttempts);
    return false;
  }

  async function pinataRequest(url, options) {
    const response = await fetchImpl(url, {
      ...options,
      signal: AbortSignal.timeout(30_000),
      headers: {
        ...options.headers,
        Authorization: `Bearer ${jwt}`,
      },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = result.error?.details
        || result.error
        || result.message
        || response.statusText;
      throw Object.assign(new Error(`Pinata request failed: ${message}`), { status: 502 });
    }
    if (!result.IpfsHash) {
      throw Object.assign(new Error('Pinata returned no IPFS CID.'), { status: 502 });
    }
    return result;
  }

  async function storeFile(bytes, contentType, fileName) {
    if (mode === 'mock') {
      const cid = `mock-${randomUUID()}`;
      mockStorage.set(cid, { bytes, contentType, fileName });
      return cid;
    }
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: contentType }), fileName);
    form.append('pinataMetadata', JSON.stringify({
      name: `WellChain_${fileName}`,
      keyvalues: { platform: 'WellChain', type: 'receipt' },
    }));
    form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

    const result = await pinataRequest('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      body: form,
    });
    return result.IpfsHash;
  }

  async function storeJson(content, title) {
    const bytes = Buffer.from(JSON.stringify(content));
    if (mode === 'mock') {
      const cid = `mock-${randomUUID()}`;
      mockStorage.set(cid, { bytes, contentType: 'application/json', fileName: `${title}.json` });
      return cid;
    }
    const result = await pinataRequest('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pinataContent: content,
        pinataMetadata: {
          name: `WellChain_Meta_${title}`,
          keyvalues: { platform: 'WellChain', type: 'campaign_metadata' },
        },
      }),
    });
    return result.IpfsHash;
  }

  const server = createServer(async (request, response) => {
    const origin = request.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-File-Name');
    } else if (origin) {
      sendJson(response, 403, { error: 'This origin is not allowed.' });
      return;
    }

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

    if (request.method === 'GET' && url.pathname === '/api/health') {
      sendJson(response, 200, {
        storageMode: mode,
        pinataConfigured: mode === 'mock' || Boolean(jwt),
      });
      return;
    }

    const mockCid = url.pathname.match(/^\/api\/ipfs\/mock\/(mock-[\w-]+)$/);
    if (request.method === 'GET' && mockCid && mode === 'mock') {
      const item = mockStorage.get(mockCid[1]);
      if (!item) {
        sendJson(response, 404, { error: 'Mock IPFS item not found.' });
        return;
      }
      response.writeHead(200, {
        'Content-Type': item.contentType,
        'Content-Disposition': `inline; filename="${item.fileName.replace(/["\\]/g, '_')}"`,
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(item.bytes);
      return;
    }

    const isUploadRoute = url.pathname === '/api/ipfs/file' || url.pathname === '/api/ipfs/json';
    if (isUploadRoute && mode === 'pinata' && !jwt) {
      sendJson(response, 503, { error: 'Set PINATA_JWT on the API server or use PINATA_MODE=mock for local testing.' });
      return;
    }

    try {
      if (request.method === 'POST' && url.pathname === '/api/ipfs/file') {
        if (isRateLimited(request)) {
          sendJson(response, 429, { error: 'Upload rate limit reached. Try again later.' });
          return;
        }
        const contentType = request.headers['content-type'] || 'application/octet-stream';
        if (!contentType.startsWith('image/') && contentType !== 'application/pdf') {
          sendJson(response, 415, { error: 'Upload an image or PDF receipt.' });
          return;
        }
        const bytes = await readBody(request, maxFileBytes);
        if (bytes.length === 0) {
          sendJson(response, 400, { error: 'The selected file is empty.' });
          return;
        }
        const fileName = normalizeFileName(request.headers['x-file-name'] || 'receipt');
        const cid = await storeFile(bytes, contentType, fileName);
        sendJson(response, 200, { cid });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/ipfs/json') {
        if (isRateLimited(request)) {
          sendJson(response, 429, { error: 'Upload rate limit reached. Try again later.' });
          return;
        }
        const bytes = await readBody(request, maxJsonBytes);
        let payload;
        try {
          payload = JSON.parse(bytes.toString('utf8'));
        } catch {
          sendJson(response, 400, { error: 'Request must contain valid JSON.' });
          return;
        }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)
          || !payload.content || typeof payload.content !== 'object' || Array.isArray(payload.content)) {
          sendJson(response, 400, { error: 'Campaign metadata content must be a JSON object.' });
          return;
        }
        const title = normalizeTitle(payload.title);
        const cid = await storeJson(payload.content, title);
        sendJson(response, 200, { cid });
        return;
      }

      sendJson(response, 404, { error: 'Not found.' });
    } catch (error) {
      if (!response.headersSent) {
        sendJson(response, error.status || 502, {
          error: error.message || 'The upload could not be completed.',
        });
      }
    }
  });

  if (port !== null) server.listen(port);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createPinataServer();
  server.on('listening', () => {
    const address = server.address();
    console.log(`WellChain API listening on http://localhost:${address.port}`);
  });
}
