-- ============================================================
-- RAGE OPTIMIZER - Supabase Database Schema
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/vvcvmcobjejddgbfojso/sql
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Guild Settings ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guild_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  guild_id TEXT NOT NULL UNIQUE,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_guild_settings_guild_id ON guild_settings(guild_id);

-- ─── Warnings ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warnings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  warned_by TEXT NOT NULL,
  warned_by_name TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT 'No reason provided',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_warnings_guild_id ON warnings(guild_id);
CREATE INDEX IF NOT EXISTS idx_warnings_user_id ON warnings(user_id);

-- ─── Tickets ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tickets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','claimed','closed')),
  claimed_by TEXT,
  claimed_by_name TEXT,
  closed_by TEXT,
  closed_by_name TEXT,
  transcript_url TEXT,
  messages JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_tickets_guild_id ON tickets(guild_id);
CREATE INDEX IF NOT EXISTS idx_tickets_channel_id ON tickets(channel_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);

-- ─── Server Backups ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS backups (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  guild_id TEXT NOT NULL,
  backup_id TEXT NOT NULL UNIQUE,
  creator_id TEXT NOT NULL,
  creator_name TEXT NOT NULL,
  name TEXT NOT NULL,
  channels JSONB DEFAULT '[]',
  roles JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_backups_guild_id ON backups(guild_id);

-- ─── Security Logs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS security_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  guild_id TEXT NOT NULL,
  action TEXT NOT NULL,
  executor_id TEXT,
  executor_name TEXT,
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_security_logs_guild_id ON security_logs(guild_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_severity ON security_logs(severity);

-- ─── Polls ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS polls (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  poll_id TEXT NOT NULL UNIQUE,
  guild_id TEXT NOT NULL,
  question TEXT NOT NULL,
  options JSONB DEFAULT '[]',
  votes JSONB DEFAULT '{}',
  creator_id TEXT NOT NULL,
  creator_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_polls_guild_id ON polls(guild_id);

-- ─── Users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  discord_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  avatar TEXT DEFAULT '',
  is_admin BOOLEAN DEFAULT FALSE,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id);

-- ─── Auto-update updated_at trigger ──────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_guild_settings_updated_at
  BEFORE UPDATE ON guild_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Storage Buckets (run manually in Storage tab if needed) ──
-- transcripts: private bucket for ticket HTML transcripts
-- media: public bucket for thumbnails and announcement images
-- backups: private bucket for config backup JSON files

-- ─── Row Level Security (RLS) ────────────────────────────────
ALTER TABLE guild_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before recreating (safe to re-run)
DROP POLICY IF EXISTS "Service role full access" ON guild_settings;
DROP POLICY IF EXISTS "Service role full access" ON warnings;
DROP POLICY IF EXISTS "Service role full access" ON tickets;
DROP POLICY IF EXISTS "Service role full access" ON backups;
DROP POLICY IF EXISTS "Service role full access" ON security_logs;
DROP POLICY IF EXISTS "Service role full access" ON polls;
DROP POLICY IF EXISTS "Service role full access" ON users;

-- Allow service_role full access (backend uses service_role key)
CREATE POLICY "Service role full access" ON guild_settings FOR ALL USING (true);
CREATE POLICY "Service role full access" ON warnings FOR ALL USING (true);
CREATE POLICY "Service role full access" ON tickets FOR ALL USING (true);
CREATE POLICY "Service role full access" ON backups FOR ALL USING (true);
CREATE POLICY "Service role full access" ON security_logs FOR ALL USING (true);
CREATE POLICY "Service role full access" ON polls FOR ALL USING (true);
CREATE POLICY "Service role full access" ON users FOR ALL USING (true);

-- ─── Done ─────────────────────────────────────────────────────
SELECT 'RAGE OPTIMIZER schema created successfully! ✅' AS status;
