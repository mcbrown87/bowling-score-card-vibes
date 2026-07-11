-- AlterTable
ALTER TABLE "stored_images" ADD COLUMN "teamId" TEXT;

-- CreateTable
CREATE TABLE "bowling_teams" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bowling_teams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bowling_teams_userId_idx" ON "bowling_teams"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "bowling_teams_userId_normalizedName_key" ON "bowling_teams"("userId", "normalizedName");

-- CreateIndex
CREATE INDEX "stored_images_teamId_idx" ON "stored_images"("teamId");

-- AddForeignKey
ALTER TABLE "bowling_teams" ADD CONSTRAINT "bowling_teams_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_images" ADD CONSTRAINT "stored_images_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "bowling_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
