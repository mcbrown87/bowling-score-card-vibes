-- AlterTable
ALTER TABLE "bowling_scores" ADD COLUMN     "playerId" TEXT;

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- Backfill durable players from existing score snapshots.
INSERT INTO "players" ("id", "userId", "name", "normalizedName", "createdAt", "updatedAt")
SELECT
    'backfill_' || md5(grouped."userId" || ':' || grouped."normalizedName"),
    grouped."userId",
    grouped."name",
    grouped."normalizedName",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT ON (si."userId", lower(regexp_replace(trim(bs."playerName"), '[[:space:]]+', ' ', 'g')))
        si."userId",
        regexp_replace(trim(bs."playerName"), '[[:space:]]+', ' ', 'g') AS "name",
        lower(regexp_replace(trim(bs."playerName"), '[[:space:]]+', ' ', 'g')) AS "normalizedName"
    FROM "bowling_scores" bs
    INNER JOIN "stored_images" si ON si."id" = bs."storedImageId"
    WHERE bs."playerName" IS NOT NULL AND trim(bs."playerName") <> ''
    ORDER BY si."userId", lower(regexp_replace(trim(bs."playerName"), '[[:space:]]+', ' ', 'g')), bs."updatedAt" DESC
) grouped;

UPDATE "bowling_scores" bs
SET "playerId" = p."id"
FROM "stored_images" si
INNER JOIN "players" p ON p."userId" = si."userId"
WHERE
    si."id" = bs."storedImageId"
    AND bs."playerName" IS NOT NULL
    AND p."normalizedName" = lower(regexp_replace(trim(bs."playerName"), '[[:space:]]+', ' ', 'g'));

-- CreateIndex
CREATE INDEX "players_userId_idx" ON "players"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "players_userId_normalizedName_key" ON "players"("userId", "normalizedName");

-- CreateIndex
CREATE INDEX "bowling_scores_playerId_idx" ON "bowling_scores"("playerId");

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bowling_scores" ADD CONSTRAINT "bowling_scores_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;
