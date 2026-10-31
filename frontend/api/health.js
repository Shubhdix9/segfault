export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const mode = process.env.PINATA_MODE || 'pinata';
  const jwt = process.env.PINATA_JWT || '';

  return res.status(200).json({
    storageMode: mode,
    pinataConfigured: mode === 'mock' || Boolean(jwt),
  });
}

