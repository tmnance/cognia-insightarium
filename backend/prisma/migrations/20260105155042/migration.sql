/*
  Warnings:

  - You are about to drop the column `title` on the `Bookmark` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Bookmark" DROP COLUMN "title",
ADD COLUMN     "firstIngestedAt" TIMESTAMP(3),
ADD COLUMN     "lastIngestedAt" TIMESTAMP(3),
ADD COLUMN     "sourceCreatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Bookmark_sourceCreatedAt_idx" ON "Bookmark"("sourceCreatedAt");

-- CreateIndex
CREATE INDEX "Bookmark_firstIngestedAt_idx" ON "Bookmark"("firstIngestedAt");

-- CreateIndex
CREATE INDEX "Bookmark_lastIngestedAt_idx" ON "Bookmark"("lastIngestedAt");
