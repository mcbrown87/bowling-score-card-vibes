-- Remove the deprecated confidence column from bowling scores
ALTER TABLE "bowling_scores"
DROP COLUMN IF EXISTS "confidence";
