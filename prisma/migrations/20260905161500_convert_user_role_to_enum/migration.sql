-- Migration: Convert User.role from String to enum Role
-- Date: 2025-09-05

-- 1. Create the new enum type
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'CHEF_DE_QUART', 'CHEF_DE_BLOC', 'RONDIER');

-- 2. Add a temporary column with the new enum type
ALTER TABLE "users" ADD COLUMN "role_new" "Role_new";

-- 3. Convert existing data with mapping
UPDATE "users" SET "role_new" = 
  CASE 
    WHEN "role" = 'admin' THEN 'ADMIN'::"Role_new"
    WHEN "role" = 'chef-de-quart' THEN 'CHEF_DE_QUART'::"Role_new"
    WHEN "role" = 'chef-de-bloc' THEN 'CHEF_DE_BLOC'::"Role_new"
    WHEN "role" = 'rondier' THEN 'RONDIER'::"Role_new"
    ELSE 'RONDIER'::"Role_new"
  END;

-- 4. Drop the old column and rename the new one
ALTER TABLE "users" DROP COLUMN "role";
ALTER TABLE "users" RENAME COLUMN "role_new" TO "role";

-- 5. Make it NOT NULL and set default
ALTER TABLE "users" ALTER COLUMN "role" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'RONDIER';

-- 6. Drop the old enum type if it exists (cleanup)
DROP TYPE IF EXISTS "Role" CASCADE;

-- 7. Rename the new type to match Prisma schema
ALTER TYPE "Role_new" RENAME TO "Role";
