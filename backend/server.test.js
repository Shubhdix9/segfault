import assert from 'node:assert/strict';
import { once } from 'node:events';
import { afterEach, beforeEach, test } from 'node:test';
import { createPinataServer } from './server.js';

let server;
let origin;

async function startServer(options = {}) {
  server = createPinataServer({ port: 0, mode: 'mock', ...options });
  await once(server, 'listening');
  const address = server.address();
  origin = `http://127.0.0.1:${address.port}`;
}

beforeEach(async () => {
  await startServer();
});

afterEach(async () => {
  if (!server?.listening) return;
  server.close();
  await once(server, 'close');
});

test('mock mode stores and serves campaign JSON without Pinata credentials', async () => {
  const response = await fetch(`${origin}/api/ipfs/json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Water project', content: { title: 'Water project', story: 'Clean water' } }),
  });
  assert.equal(response.status, 200);
  const { cid } = await response.json();
  assert.match(cid, /^mock-/);

  const stored = await fetch(`${origin}/api/ipfs/mock/${cid}`);
  assert.equal(stored.status, 200);
  assert.match(stored.headers.get('content-type'), /application\/json/);
  assert.deepEqual(await stored.json(), { title: 'Water project', story: 'Clean water' });
});

test('mock mode stores and serves an image receipt', async () => {
  const receipt = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const response = await fetch(`${origin}/api/ipfs/file`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png', 'X-File-Name': 'receipt.png' },
    body: receipt,
  });
  assert.equal(response.status, 200);
  const { cid } = await response.json();

  const stored = await fetch(`${origin}/api/ipfs/mock/${cid}`);
  assert.equal(stored.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await stored.arrayBuffer()), receipt);
});

test('rejects invalid metadata, unsupported files, and disallowed browser origins', async () => {
  const badMetadata = await fetch(`${origin}/api/ipfs/json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"content":[]}',
  });
  assert.equal(badMetadata.status, 400);

  const badFile = await fetch(`${origin}/api/ipfs/file`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: 'not a receipt',
  });
  assert.equal(badFile.status, 415);

  const badOrigin = await fetch(`${origin}/api/health`, {
    headers: { Origin: 'https://untrusted.example' },
  });
  assert.equal(badOrigin.status, 403);
});

test('uses the Pinata API only in real mode and keeps the JWT server-side', async (context) => {
  await new Promise((resolve) => {
    server.close(resolve);
  });
  context.after(() => {
    if (server?.listening) server.close();
  });

  let observedRequest;
  await startServer({
    mode: 'pinata',
    jwt: 'test-secret',
    fetchImpl: async (url, options) => {
      observedRequest = { url, options };
      return Response.json({ IpfsHash: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3vj6u5x5s2k25zg3foe7f7f2a' });
    },
  });

  const response = await fetch(`${origin}/api/ipfs/json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Water project', content: { title: 'Water project' } }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3vj6u5x5s2k25zg3foe7f7f2a',
  });
  assert.equal(observedRequest.url, 'https://api.pinata.cloud/pinning/pinJSONToIPFS');
  assert.equal(observedRequest.options.headers.Authorization, 'Bearer test-secret');
  assert.deepEqual(JSON.parse(observedRequest.options.body).pinataContent, { title: 'Water project' });
});

test('mock mode is refused in production', () => {
  assert.throws(
    () => createPinataServer({ port: null, mode: 'mock', nodeEnv: 'production' }),
    /cannot run in production/,
  );
});
