-- Mark scorecard images as league games and allow a second team on the image.
ALTER TABLE "stored_images"
ADD COLUMN "isLeagueGame" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "opponentTeamId" TEXT;

-- Assign each extracted or corrected score to one of the teams on its image.
ALTER TABLE "bowling_scores"
ADD COLUMN "teamId" TEXT;

CREATE INDEX "stored_images_opponentTeamId_idx" ON "stored_images"("opponentTeamId");
CREATE INDEX "bowling_scores_teamId_idx" ON "bowling_scores"("teamId");

ALTER TABLE "stored_images"
ADD CONSTRAINT "stored_images_opponentTeamId_fkey"
FOREIGN KEY ("opponentTeamId") REFERENCES "bowling_teams"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bowling_scores"
ADD CONSTRAINT "bowling_scores_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "bowling_teams"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
