-- ============================================================
-- SegFault Database Schema for Supabase (PostgreSQL)
-- Milestone-based Blockchain Charity Platform
-- ============================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- 1. Campaigns Table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) DEFAULT 'General',
    target_amount NUMERIC(18, 4) NOT NULL CHECK (target_amount > 0),
    raised_amount NUMERIC(18, 4) DEFAULT 0 CHECK (raised_amount >= 0),
    recipient_address VARCHAR(42) NOT NULL, -- Ethereum address (0x...)
    contract_address VARCHAR(42),           -- Associated smart contract address
    creator_address VARCHAR(42) NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'paused', 'cancelled')),
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ------------------------------------------------------------
-- 2. Milestones Table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    milestone_index INTEGER NOT NULL CHECK (milestone_index >= 0),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    target_payout NUMERIC(18, 4) NOT NULL CHECK (target_payout > 0),
    proof_uri TEXT,                         -- IPFS URI or document URL
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'released', 'rejected')),
    approved_at TIMESTAMP WITH TIME ZONE,
    released_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_campaign_milestone_index UNIQUE (campaign_id, milestone_index)
);

-- ------------------------------------------------------------
-- 3. Donations Table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.donations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    donor_address VARCHAR(42) NOT NULL,     -- Ethereum wallet address
    amount NUMERIC(18, 4) NOT NULL CHECK (amount > 0),
    tx_hash VARCHAR(66) NOT NULL UNIQUE,    -- Ethereum transaction hash (0x...)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ------------------------------------------------------------
-- 4. Indexes for Fast Queries
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_recipient ON public.campaigns(recipient_address);
CREATE INDEX IF NOT EXISTS idx_milestones_campaign ON public.milestones(campaign_id);
CREATE INDEX IF NOT EXISTS idx_donations_campaign ON public.donations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_donations_donor ON public.donations(donor_address);

-- ------------------------------------------------------------
-- 5. Row Level Security (RLS)
-- ------------------------------------------------------------
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

-- Public read access policies
CREATE POLICY "Public read campaigns" ON public.campaigns
    FOR SELECT USING (true);

CREATE POLICY "Public read milestones" ON public.milestones
    FOR SELECT USING (true);

CREATE POLICY "Public read donations" ON public.donations
    FOR SELECT USING (true);

-- Service role full access policies
CREATE POLICY "Service role full access on campaigns" ON public.campaigns
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on milestones" ON public.milestones
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on donations" ON public.donations
    FOR ALL USING (auth.role() = 'service_role');

