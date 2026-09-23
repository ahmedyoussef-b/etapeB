-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "injectedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "documents_injectedAt_idx" ON "documents"("injectedAt");
