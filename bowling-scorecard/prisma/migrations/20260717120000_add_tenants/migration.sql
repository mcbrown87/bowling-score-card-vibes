-- CreateEnum
CREATE TYPE "TenantMembershipRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_memberships" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TenantMembershipRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("id")
);

-- Add nullable tenant columns for backfill.
ALTER TABLE "users" ADD COLUMN "activeTenantId" TEXT;
ALTER TABLE "stored_images" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "players" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "bowling_teams" ADD COLUMN "tenantId" TEXT;

-- Backfill one personal tenant per existing user.
INSERT INTO "tenants" ("id", "name", "createdAt", "updatedAt")
SELECT
  'tenant_' || "id",
  COALESCE(NULLIF("name", ''), "email"),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "users";

INSERT INTO "tenant_memberships" ("id", "tenantId", "userId", "role", "createdAt", "updatedAt")
SELECT
  'tenant_membership_' || "id",
  'tenant_' || "id",
  "id",
  'OWNER'::"TenantMembershipRole",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "users";

UPDATE "stored_images"
SET "tenantId" = 'tenant_' || "userId"
WHERE "tenantId" IS NULL;

UPDATE "players"
SET "tenantId" = 'tenant_' || "userId"
WHERE "tenantId" IS NULL;

UPDATE "bowling_teams"
SET "tenantId" = 'tenant_' || "userId"
WHERE "tenantId" IS NULL;

UPDATE "users"
SET "activeTenantId" = 'tenant_' || "id"
WHERE "activeTenantId" IS NULL;

-- Enforce required tenant ownership.
ALTER TABLE "stored_images" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "players" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "bowling_teams" ALTER COLUMN "tenantId" SET NOT NULL;

-- Drop old per-user uniqueness in favor of per-tenant uniqueness.
DROP INDEX "players_userId_normalizedName_key";
DROP INDEX "bowling_teams_userId_normalizedName_key";

-- CreateIndex
CREATE UNIQUE INDEX "tenant_memberships_tenantId_userId_key" ON "tenant_memberships"("tenantId", "userId");
CREATE INDEX "tenant_memberships_userId_idx" ON "tenant_memberships"("userId");
CREATE INDEX "users_activeTenantId_idx" ON "users"("activeTenantId");
CREATE UNIQUE INDEX "players_tenantId_normalizedName_key" ON "players"("tenantId", "normalizedName");
CREATE INDEX "players_tenantId_idx" ON "players"("tenantId");
CREATE UNIQUE INDEX "bowling_teams_tenantId_normalizedName_key" ON "bowling_teams"("tenantId", "normalizedName");
CREATE INDEX "bowling_teams_tenantId_idx" ON "bowling_teams"("tenantId");
CREATE INDEX "stored_images_tenantId_idx" ON "stored_images"("tenantId");

-- AddForeignKey
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_activeTenantId_fkey" FOREIGN KEY ("activeTenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stored_images" ADD CONSTRAINT "stored_images_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "players" ADD CONSTRAINT "players_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bowling_teams" ADD CONSTRAINT "bowling_teams_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
