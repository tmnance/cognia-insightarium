-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "platformUserId" TEXT,
    "platformUsername" TEXT,
    "lastFetchedAt" TIMESTAMP(3),
    "lastFetchedPostId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Integration_platform_key" ON "Integration"("platform");

-- CreateIndex
CREATE INDEX "Integration_platform_idx" ON "Integration"("platform");
