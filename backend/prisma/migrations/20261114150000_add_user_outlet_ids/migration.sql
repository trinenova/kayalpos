-- Outlets a user is allowed to work in (empty = all outlets).
ALTER TABLE "User" ADD COLUMN "OutletIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
