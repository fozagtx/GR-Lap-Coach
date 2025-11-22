/*
  # Create Telemetry and Chat Tables

  1. New Tables
    - `telemetry_sessions`
      - `id` (uuid, primary key)
      - `track_name` (text)
      - `file_name` (text)
      - `file_path` (text) - Storage path
      - `theoretical_time` (numeric) - Best lap time in seconds
      - `sector_stats` (jsonb) - Sector analysis data
      - `chart_data` (jsonb) - Chart visualization data
      - `created_at` (timestamptz)
    
    - `chat_messages`
      - `id` (uuid, primary key)
      - `session_id` (uuid, foreign key to telemetry_sessions)
      - `role` (text) - 'user' or 'assistant'
      - `content` (text)
      - `created_at` (timestamptz)
  
  2. Security
    - Enable RLS on both tables
    - Public access for demo purposes (can be restricted later with auth)
*/

CREATE TABLE IF NOT EXISTS telemetry_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_name text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  theoretical_time numeric,
  sector_stats jsonb,
  chart_data jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES telemetry_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE telemetry_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to telemetry sessions"
  ON telemetry_sessions FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to telemetry sessions"
  ON telemetry_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public read access to chat messages"
  ON chat_messages FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to chat messages"
  ON chat_messages FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_sessions_created_at ON telemetry_sessions(created_at DESC);
