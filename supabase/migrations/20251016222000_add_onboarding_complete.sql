-- Add onboarding_complete column to user_profiles
ALTER TABLE user_profiles
ADD COLUMN onboarding_complete BOOLEAN NOT NULL DEFAULT false;

-- Add index for faster lookups
CREATE INDEX idx_user_profiles_onboarding ON user_profiles(onboarding_complete)
  WHERE onboarding_complete = false;

COMMENT ON COLUMN user_profiles.onboarding_complete IS 'Whether the user has completed the onboarding flow';

