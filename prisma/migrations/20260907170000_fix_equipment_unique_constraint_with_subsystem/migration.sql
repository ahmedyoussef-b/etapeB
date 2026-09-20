-- Fix equipment unique constraint to include subsystemCode

-- Drop the old unique index on (code, blocCode)
DROP INDEX IF EXISTS "equipments_code_blocCode_key";

-- Create new unique index on (code, blocCode, subsystemCode)
CREATE UNIQUE INDEX "equipments_code_blocCode_subsystemCode_key" ON "equipments"("code","blocCode","subsystemCode");
