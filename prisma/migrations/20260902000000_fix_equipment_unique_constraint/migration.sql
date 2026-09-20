-- Fix: equipment (and group-equipment) codes are unique only within their
-- block/group, not globally. The initial migration created a global unique
-- index on `code`, which collides with shared codes across blocks
-- (e.g. LJP, CRF, GIS in A0/B0/B1/B2/B3) and causes Centrale to appear
-- truncated/empty in the web structure.
--
-- This drops the global unique index and adds a composite one.

-- 1. Equipment: unique per (code, blocCode)
DROP INDEX IF EXISTS "equipments_code_key";
CREATE UNIQUE INDEX "equipments_code_blocCode_key" ON "equipments"("code","blocCode");

-- 2. Group equipment: unique per (code, groupeCode)
DROP INDEX IF EXISTS "group_equipments_code_key";
CREATE UNIQUE INDEX "group_equipments_code_groupeCode_key" ON "group_equipments"("code","groupeCode");

-- 3. Align syncState default with the canonical enum value (local_only)
ALTER TABLE "blocks"             ALTER COLUMN "syncState" SET DEFAULT 'local_only';
ALTER TABLE "equipments"         ALTER COLUMN "syncState" SET DEFAULT 'local_only';
ALTER TABLE "groups"             ALTER COLUMN "syncState" SET DEFAULT 'local_only';
ALTER TABLE "group_equipments"   ALTER COLUMN "syncState" SET DEFAULT 'local_only';
