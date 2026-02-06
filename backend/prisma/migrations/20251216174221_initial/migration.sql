-- CreateTable
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT,
    "url" TEXT,
    "title" TEXT,
    "content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bookmark_url_idx" ON "Bookmark"("url");

-- CreateIndex
CREATE INDEX "Bookmark_source_idx" ON "Bookmark"("source");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_source_externalId_key" ON "Bookmark"("source", "externalId");
