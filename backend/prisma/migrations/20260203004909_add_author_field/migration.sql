/*
  Warnings:

  - You are about to drop the `Integration` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "Bookmark" ADD COLUMN     "author" TEXT;

-- DropTable
DROP TABLE "Integration";
