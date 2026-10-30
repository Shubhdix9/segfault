import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { supabase } from './supabaseClient.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'segfault-backend',
    supabaseConnected: Boolean(supabase),
    timestamp: new Date().toISOString(),
  });
});

// Fetch all campaigns
app.get('/api/campaigns', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase client not configured' });
  }

  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*, milestones(*)');

    if (error) throw error;
    res.json({ campaigns: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch milestones for a campaign
app.get('/api/milestones/:campaignId', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase client not configured' });
  }

  try {
    const { campaignId } = req.params;
    const { data, error } = await supabase
      .from('milestones')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('milestone_index', { ascending: true });

    if (error) throw error;
    res.json({ milestones: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Record a verified donation
app.post('/api/donations', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase client not configured' });
  }

  const { campaignId, donorAddress, amount, txHash } = req.body;

  if (!campaignId || !donorAddress || !amount || !txHash) {
    return res.status(400).json({ error: 'Missing required donation fields' });
  }

  try {
    const { data, error } = await supabase
      .from('donations')
      .insert([{
        campaign_id: campaignId,
        donor_address: donorAddress,
        amount,
        tx_hash: txHash,
      }])
      .select();

    if (error) throw error;
    res.status(201).json({ donation: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 SegFault backend listening on port ${PORT}`);
});

export default app;

