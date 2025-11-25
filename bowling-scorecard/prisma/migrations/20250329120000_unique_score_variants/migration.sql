-- CreateIndex
CREATE UNIQUE INDEX "bowling_scores_storedImageId_gameIndex_isEstimate_key" ON "bowling_scores"("storedImageId", "gameIndex", "isEstimate");
