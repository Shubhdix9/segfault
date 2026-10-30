# SegFault Backend & Supabase Service

Backend API service and Supabase database architecture for the SegFault milestone charity platform.

## Architecture

- **PostgreSQL Database via Supabase:** Stores off-chain campaigns, milestone definitions, proofs, and donation audit trails.
- **Express API:** Microservice for syncing blockchain events, querying campaigns, and validating submissions.
- **Row Level Security (RLS):** Secures public read access while restricting mutations to authorized service roles.

## Database Setup (Supabase)

1. Create a project at [Supabase](https://supabase.com).
2. Open the **SQL Editor** in your Supabase dashboard.
3. Paste and run the contents of `supabase/schema.sql`.
4. Copy your **Project URL**, **Anon Key**, and **Service Role Key** from Settings -> API.

## Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in:

```env
PORT=5000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Running the Backend

```bash
npm install
npm run dev
```

The health check endpoint will be available at `http://localhost:5000/api/health`.

