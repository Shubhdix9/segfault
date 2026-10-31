export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const jwt = process.env.PINATA_JWT || '';
  if (!jwt) {
    return res.status(503).json({ error: 'PINATA_JWT is not configured on Vercel.' });
  }

  const payload = req.body;
  if (
    !payload
    || typeof payload !== 'object'
    || Array.isArray(payload)
    || !payload.content
    || typeof payload.content !== 'object'
    || Array.isArray(payload.content)
  ) {
    return res.status(400).json({ error: 'Campaign metadata content must be a JSON object.' });
  }

  const title = String(payload.title || 'Campaign').replace(/[^\w.-]/g, '_').slice(0, 80) || 'Campaign';

  try {
    const pinataRes = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        pinataContent: payload.content,
        pinataMetadata: {
          name: `WellChain_Meta_${title}`,
          keyvalues: { platform: 'WellChain', type: 'campaign_metadata' },
        },
      }),
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

