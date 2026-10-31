const apiBase = (import.meta.env?.VITE_API_URL || '').replace(/\/$/, '');
const gateway = (import.meta.env?.VITE_PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs')
  .replace(/\/$/, '');

async function readUploadResponse(response) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Upload failed (${response.status}).`);
  if (!result.cid) throw new Error('The upload service returned no IPFS CID.');
  return { cid: result.cid, url: getIPFSUrl(result.cid) };
}

export async function uploadFileToIPFS(file) {
  try {
    const response = await fetch(`${apiBase}/api/ipfs/file`, {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-File-Name': encodeURIComponent(file.name),
      },
      body: file,
    });
    return await readUploadResponse(response);
  } catch (err) {
    if (err.name === 'TypeError' && err.message?.toLowerCase().includes('fetch')) {
      throw new Error('Upload backend is offline. Start the backend with: cd backend && npm run dev');
    }
    throw err;
  }
}

export async function uploadJSONToIPFS(content, title) {
  try {
    const response = await fetch(`${apiBase}/api/ipfs/json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, title }),
    });
    return await readUploadResponse(response);
  } catch (err) {
    if (err.name === 'TypeError' && err.message?.toLowerCase().includes('fetch')) {
      throw new Error('Upload backend is offline. Start the backend with: cd backend && npm run dev');
    }
    throw err;
  }
}

export async function getIPFSHealth() {
  const response = await fetch(`${apiBase}/api/health`);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Upload service check failed (${response.status}).`);
  return {
    storageMode: result.storageMode,
    pinataConfigured: Boolean(result.pinataConfigured),
  };
}

export function getIPFSUrl(cid) {
  if (!cid) return '';
  if (cid.startsWith('mock-')) {
    return `${apiBase}/api/ipfs/mock/${encodeURIComponent(cid)}`;
  }
  if (/^https?:\/\//i.test(cid)) return '';
  const normalized = cid.replace(/^ipfs:\/\//, '').replace(/^\/+/, '');
  if (!/^(?:Qm[A-Za-z0-9]{44}|b[a-z2-7]{20,})(?:\/[\w./-]*)?$/.test(normalized)) {
    return '';
  }
  return `${gateway}/${normalized}`;
}

export async function fetchIPFSJSON(cid) {
  const url = getIPFSUrl(cid);
  if (!url) throw new Error('Invalid IPFS content identifier.');
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const error = new Error(`Could not load campaign metadata (${response.status}).`);
        error.retryable = response.status === 404 || response.status === 429 || response.status >= 500;
        throw error;
      }
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('json')) throw new Error('Campaign metadata on IPFS is not JSON.');
      const metadata = await response.json();
      if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        throw new Error('Campaign metadata on IPFS must be a JSON object.');
      }
      return metadata;
    } catch (error) {
      const retryable = error.retryable || error instanceof TypeError;
      if (!retryable || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    }
  }
  throw new Error('Could not load JSON from IPFS.');
}
