
-- AlterTable
ALTER TABLE "equipments" ADD COLUMN "subsystemCode" TEXT;

-- CreateIndex
CREATE INDEX "equipments_subsystemCode_idx" ON "equipments"("subsystemCode");

