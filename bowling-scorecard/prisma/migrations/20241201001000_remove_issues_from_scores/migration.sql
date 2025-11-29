-- Drop the deprecated issues column from bowling scores
ALTER TABLE "bowling_scores"
DROP COLUMN IF EXISTS "issues";
