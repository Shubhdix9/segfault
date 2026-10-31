export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const jwt = process.env.PINATA_JWT || '';
  if (!jwt) {
    return res.status(503).json({ error: 'PINATA_JWT is not configured on Vercel.' });
  }

  const chunks = [];
  let size = 0;
  const maxFileBytes = 20 * 1024 * 1024;

  try {
    for await (const chunk of req) {
      size += chunk.length;
      if (size > maxFileBytes) {
        return res.status(413).json({ error: 'File size exceeds 20MB limit.' });
      }
      chunks.push(chunk);
    }
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read file stream.' });
  }

  const bytes = Buffer.concat(chunks);
  if (bytes.length === 0) {
    return res.status(400).json({ error: 'Uploaded file is empty.' });
  }

  const contentType = req.headers['content-type'] || 'application/octet-stream';
  const rawName = req.headers['x-file-name'] || 'receipt';
  let fileName = 'receipt';
  try {
    fileName = decodeURIComponent(rawName).replace(/[^\w.-]/g, '_').slice(0, 120) || 'receipt';
  } catch {
    fileName = 'receipt';
  }

  try {
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: contentType }), fileName);
    form.append('pinataMetadata', JSON.stringify({
      name: `WellChain_${fileName}`,
      keyvalues: { platform: 'WellChain', type: 'receipt' },
    }));
    form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

    const pinataRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
      body: form,
      signal: AbortSignal.timeout(30000),
    });

    const result = await pinataRes.json().catch(() => ({}));
    if (!pinataRes.ok || !result.IpfsHash) {
      const msg = result.error?.details || result.error || result.message || 'Pinata upload failed';
      return res.status(502).json({ error: msg });
    }

    return res.status(200).json({ cid: result.IpfsHash });
  } catch (err) {
    return res.status(502).json({ error: err.message || 'Upload failed' });
  }
}

