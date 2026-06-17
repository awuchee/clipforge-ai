-- CreateEnum
CREATE TYPE "AdProjectStatus" AS ENUM ('DRAFT', 'PLAN_READY', 'QUEUED', 'PROCESSING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "ad_projects" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productDescription" TEXT NOT NULL,
    "targetAudience" TEXT,
    "tone" TEXT,
    "productImageUrls" TEXT[],
    "status" "AdProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "errorMessage" TEXT,
    "plan" JSONB,
    "storageKey" TEXT,
    "thumbnailKey" TEXT,
    "srtKey" TEXT,
    "videoUrl" TEXT,
    "durationSec" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ad_projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ad_projects_userId_idx" ON "ad_projects"("userId");

-- AddForeignKey
ALTER TABLE "ad_projects" ADD CONSTRAINT "ad_projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
