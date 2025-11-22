-- CreateTable
CREATE TABLE "bowling_scores" (
    "id" TEXT NOT NULL,
    "storedImageId" TEXT NOT NULL,
    "gameIndex" INTEGER NOT NULL,
    "playerName" TEXT,
    "totalScore" INTEGER,
    "frames" JSONB NOT NULL,
    "tenthFrame" JSONB,
    "issues" JSONB,
    "confidence" DOUBLE PRECISION,
    "provider" TEXT,
    "isEstimate" BOOLEAN NOT NULL DEFAULT TRUE,
    "rawText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bowling_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bowling_scores_storedImageId_idx" ON "bowling_scores"("storedImageId");

-- AddForeignKey
ALTER TABLE "bowling_scores"
ADD CONSTRAINT "bowling_scores_storedImageId_fkey" FOREIGN KEY ("storedImageId") REFERENCES "stored_images"("id") ON DELETE CASCADE ON UPDATE CASCADE;
