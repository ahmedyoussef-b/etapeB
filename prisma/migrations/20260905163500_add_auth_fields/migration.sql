-- Convert syncState columns from TEXT to SyncState enum
-- and add authentication fields to users and procedures tables

-- 1. Convert syncState columns to enum
ALTER TABLE "blocks" ALTER COLUMN "syncState" DROP DEFAULT, ALTER COLUMN "syncState" TYPE "SyncState" USING "syncState"::"SyncState", ALTER COLUMN "syncState" SET DEFAULT 'local_only';
ALTER TABLE "equipments" ALTER COLUMN "syncState" DROP DEFAULT, ALTER COLUMN "syncState" TYPE "SyncState" USING "syncState"::"SyncState", ALTER COLUMN "syncState" SET DEFAULT 'local_only';
ALTER TABLE "groups" ALTER COLUMN "syncState" DROP DEFAULT, ALTER COLUMN "syncState" TYPE "SyncState" USING "syncState"::"SyncState", ALTER COLUMN "syncState" SET DEFAULT 'local_only';
ALTER TABLE "group_equipments" ALTER COLUMN "syncState" DROP DEFAULT, ALTER COLUMN "syncState" TYPE "SyncState" USING "syncState"::"SyncState", ALTER COLUMN "syncState" SET DEFAULT 'local_only';

-- 2. Add authentication fields to users table
ALTER TABLE "users" ADD COLUMN "blockId" TEXT;
ALTER TABLE "users" ADD COLUMN "password" TEXT;

-- 3. Add foreign key for users.blockId -> blocks.id
ALTER TABLE "users" ADD CONSTRAINT "users_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Add authentication fields to procedures table
ALTER TABLE "procedures" ADD COLUMN "createdById" TEXT;
ALTER TABLE "procedures" DROP COLUMN "requiredRoles";
ALTER TABLE "procedures" ADD COLUMN "requiredRoles" "Role"[];

-- 5. Add foreign key for procedures.createdById -> users.id
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. Add indexes
CREATE INDEX "procedures_createdById_idx" ON "procedures"("createdById");

-- 7. Add path column to documents with unique constraint
ALTER TABLE "documents" ADD COLUMN "path" TEXT;
CREATE UNIQUE INDEX "documents_path_key" ON "documents"("path");
CREATE INDEX "documents_filename_idx" ON "documents"("filename");

-- 8. Add metadata to reports
ALTER TABLE "reports" ADD COLUMN "metadata" JSONB;
