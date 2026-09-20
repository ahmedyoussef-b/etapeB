-- CreateTable
CREATE TABLE "PublishQueue" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "content" BYTEA,
    "textContent" TEXT,
    "hash" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "version" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "transferredTo" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "PublishQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSyncState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncVersion" TEXT,
    "pendingCount" INTEGER NOT NULL DEFAULT 0,
    "syncedFileIds" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "UserSyncState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemVersion" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedBy" TEXT NOT NULL,
    "changelog" TEXT,
    "fileCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SystemVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublishQueue_publishedAt_idx" ON "PublishQueue"("publishedAt");

-- CreateIndex
CREATE INDEX "PublishQueue_expiresAt_idx" ON "PublishQueue"("expiresAt");

-- CreateIndex
CREATE INDEX "PublishQueue_path_idx" ON "PublishQueue"("path");

-- CreateIndex
CREATE UNIQUE INDEX "UserSyncState_userId_key" ON "UserSyncState"("userId");

-- CreateIndex
CREATE INDEX "UserSyncState_userId_idx" ON "UserSyncState"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemVersion_version_key" ON "SystemVersion"("version");

-- CreateIndex
CREATE INDEX "SystemVersion_publishedAt_idx" ON "SystemVersion"("publishedAt");
