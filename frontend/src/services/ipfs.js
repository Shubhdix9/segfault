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
  const response = await fetch(`${apiBase}/api/ipfs/file`, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'X-File-Name': encodeURIComponent(file.name),
    },
    body: file,
  });
  return readUploadResponse(response);
}

export async function uploadJSONToIPFS(content, title) {
  const response = await fetch(`${apiBase}/api/ipfs/json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, title }),
  });
  return readUploadResponse(response);
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
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load campaign metadata (${response.status}).`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('json')) throw new Error('Campaign metadata on IPFS is not JSON.');
  const metadata = await response.json();
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('Campaign metadata on IPFS must be a JSON object.');
  }
  return metadata;
}
