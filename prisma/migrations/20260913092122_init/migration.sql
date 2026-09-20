-- CreateTable
CREATE TABLE "procedure_media" (
    "id" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "procedureCode" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "geolocation" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT,
    "metadata" JSONB,

    CONSTRAINT "procedure_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "procedure_media_procedureId_idx" ON "procedure_media"("procedureId");

-- CreateIndex
CREATE INDEX "procedure_media_procedureCode_idx" ON "procedure_media"("procedureCode");

-- CreateIndex
CREATE INDEX "procedure_media_stepId_idx" ON "procedure_media"("stepId");

-- CreateIndex
CREATE INDEX "procedure_media_capturedAt_idx" ON "procedure_media"("capturedAt");
