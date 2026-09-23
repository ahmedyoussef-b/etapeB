-- CreateTable
CREATE TABLE "web_files" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "web_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "web_files_path_key" ON "web_files"("path");

-- CreateIndex
CREATE INDEX "web_files_path_idx" ON "web_files"("path");

-- CreateIndex
CREATE INDEX "web_files_hash_idx" ON "web_files"("hash");
