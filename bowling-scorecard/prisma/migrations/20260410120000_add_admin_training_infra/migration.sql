CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

ALTER TABLE "users"
ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';

CREATE TABLE "app_config" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_config_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "model_artifacts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "architecture" TEXT NOT NULL,
    "storageBucket" TEXT,
    "storageObjectKey" TEXT,
    "localPath" TEXT,
    "datasetImageCount" INTEGER,
    "datasetCorrectionCount" INTEGER,
    "metrics" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "model_artifacts_name_version_key" ON "model_artifacts"("name", "version");
CREATE INDEX "model_artifacts_isActive_idx" ON "model_artifacts"("isActive");
