-- CreateTable
CREATE TABLE "stored_images" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalFileName" TEXT,
    "contentType" TEXT,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stored_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stored_images_bucket_objectKey_key" ON "stored_images"("bucket", "objectKey");

-- CreateIndex
CREATE INDEX "stored_images_userId_idx" ON "stored_images"("userId");

-- AddForeignKey
ALTER TABLE "stored_images"
ADD CONSTRAINT "stored_images_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
