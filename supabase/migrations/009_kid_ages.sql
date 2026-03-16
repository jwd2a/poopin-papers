-- Add kid_ages array to profiles for age-appropriate content generation
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kid_ages integer[] DEFAULT '{}';

-- Backfill from household_members where available
UPDATE profiles p
SET kid_ages = sub.ages
FROM (
  SELECT user_id, array_agg(age ORDER BY age) AS ages
  FROM household_members
  WHERE role = 'kid' AND age IS NOT NULL
  GROUP BY user_id
) sub
WHERE p.id = sub.user_id AND (p.kid_ages IS NULL OR p.kid_ages = '{}');
