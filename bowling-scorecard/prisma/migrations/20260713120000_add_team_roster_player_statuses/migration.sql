CREATE TABLE "team_roster_player_statuses" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "isDisabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL,

    CONSTRAINT "team_roster_player_statuses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "team_roster_player_statuses_teamId_playerId_key" ON "team_roster_player_statuses"("teamId", "playerId");
CREATE INDEX "team_roster_player_statuses_playerId_idx" ON "team_roster_player_statuses"("playerId");

ALTER TABLE "team_roster_player_statuses" ADD CONSTRAINT "team_roster_player_statuses_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "bowling_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_roster_player_statuses" ADD CONSTRAINT "team_roster_player_statuses_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
