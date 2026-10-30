import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  fetchIPFSJSON,
  getIPFSUrl,
  uploadFileToIPFS,
  uploadJSONToIPFS,
} from './ipfs.js';

test('uploads metadata using the same-origin API and returns an IPFS URL', async (context) => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return Response.json({ cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3vj6u5x5s2k25zg3foe7f7f2a' });
  };
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await uploadJSONToIPFS({ title: 'AquaChain' }, 'Campaign');
  assert.equal(request.url, '/api/ipfs/json');
  assert.equal(request.options.method, 'POST');
  assert.deepEqual(JSON.parse(request.options.body), {
    content: { title: 'AquaChain' },
    title: 'Campaign',
  });
  assert.equal(result.cid, 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3vj6u5x5s2k25zg3foe7f7f2a');
  assert.equal(result.url, getIPFSUrl(result.cid));
});

test('uploads a file without putting credentials in browser requests', async (context) => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return Response.json({ cid: 'mock-receipt-cid' });
  };
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  const file = new File(['receipt'], 'store receipt.pdf', { type: 'application/pdf' });
  const result = await uploadFileToIPFS(file);
  assert.equal(request.url, '/api/ipfs/file');
  assert.equal(request.options.headers['Content-Type'], 'application/pdf');
  assert.equal(request.options.headers['X-File-Name'], 'store%20receipt.pdf');
  assert.equal('Authorization' in request.options.headers, false);
  assert.equal(result.url, '/api/ipfs/mock/mock-receipt-cid');
});

test('loads mock IPFS JSON and rejects arbitrary HTTP links as CIDs', async (context) => {
  const originalFetch = globalThis.fetch;
  let requestedUrl;
  globalThis.fetch = async (url) => {
    requestedUrl = url;
    return Response.json({ title: 'Campaign' });
  };
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  assert.deepEqual(await fetchIPFSJSON('mock-metadata-cid'), { title: 'Campaign' });
  assert.equal(requestedUrl, '/api/ipfs/mock/mock-metadata-cid');
  assert.equal(getIPFSUrl('https://untrusted.example/receipt.pdf'), '');
});

test('surfaces upload and metadata response errors', async (context) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ error: 'Pinata is not configured.' }),
    { status: 503, headers: { 'Content-Type': 'application/json' } },
  );
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  await assert.rejects(uploadJSONToIPFS({}, 'Campaign'), /Pinata is not configured/);
});
