-- Enable UUID extension if not already
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  address TEXT NOT NULL UNIQUE CHECK (address ~ '^0x[a-fA-F0-9]{40}$'),  -- Ethereum address validation
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Policies for user_profiles (read own, no direct insert/update)
CREATE POLICY "Users can read their own profile"
ON public.user_profiles
FOR SELECT
USING (auth.uid() = user_id);

-- Trigger function to insert into user_profiles on auth.users creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, address)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'ethereum_address')
  ON CONFLICT (user_id) DO NOTHING;  -- Avoid duplicates if trigger re-runs
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();