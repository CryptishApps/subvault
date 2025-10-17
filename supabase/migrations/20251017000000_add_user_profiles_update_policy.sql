-- Add UPDATE policy for user_profiles
-- This allows users to update their own profile (needed for onboarding_complete, sub_account_address, etc.)
CREATE POLICY "Users can update their own profile"
ON public.user_profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Also add comment for clarity
COMMENT ON POLICY "Users can update their own profile" ON public.user_profiles IS 
  'Allows users to update their own profile fields like onboarding_complete and sub_account_address';

