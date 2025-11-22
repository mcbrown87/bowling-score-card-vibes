-- CreateTable
CREATE TABLE "llm_requests" (
    "id" TEXT NOT NULL,
    "storedImageId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "promptText" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "rawRequest" JSONB,
    "rawResponse" JSONB,
    "rawText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompts" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prompts_version_key" ON "prompts"("version");

-- CreateIndex
CREATE INDEX "llm_requests_storedImageId_idx" ON "llm_requests"("storedImageId");

-- AddForeignKey
ALTER TABLE "llm_requests"
ADD CONSTRAINT "llm_requests_storedImageId_fkey" FOREIGN KEY ("storedImageId") REFERENCES "stored_images"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "llm_requests_promptId_idx" ON "llm_requests"("promptId");

-- AddForeignKey
ALTER TABLE "llm_requests"
ADD CONSTRAINT "llm_requests_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "prompts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "bowling_scores"
ADD COLUMN "llmRequestId" TEXT;

-- CreateIndex
CREATE INDEX "bowling_scores_llmRequestId_idx" ON "bowling_scores"("llmRequestId");

-- AddForeignKey
ALTER TABLE "bowling_scores"
ADD CONSTRAINT "bowling_scores_llmRequestId_fkey" FOREIGN KEY ("llmRequestId") REFERENCES "llm_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
