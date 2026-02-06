-- AlterTable
ALTER TABLE "Bookmark" ADD COLUMN     "taggingReviewedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Bookmark_taggingReviewedAt_idx" ON "Bookmark"("taggingReviewedAt");
