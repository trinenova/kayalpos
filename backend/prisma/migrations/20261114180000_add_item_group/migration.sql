-- Item Group master. Existing product groups are backfilled into it (one row
-- per distinct Product.Group per tenant) so current products keep a matching
-- master entry and the Product form's dropdown isn't empty after upgrading.
CREATE TABLE "ItemGroup" (
    "Id" TEXT NOT NULL,
    "TenantId" TEXT NOT NULL,
    "Code" TEXT NOT NULL,
    "Name" TEXT NOT NULL,
    "Description" TEXT,
    "Status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "SapRef" TEXT,
    "SapSyncStatus" TEXT NOT NULL DEFAULT 'Pending',
    "SapSyncDate" TIMESTAMP(3),
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "CreatedBy" TEXT,
    "UpdatedBy" TEXT,

    CONSTRAINT "ItemGroup_pkey" PRIMARY KEY ("Id")
);

CREATE UNIQUE INDEX "ItemGroup_TenantId_Code_key" ON "ItemGroup"("TenantId", "Code");
CREATE UNIQUE INDEX "ItemGroup_TenantId_Name_key" ON "ItemGroup"("TenantId", "Name");
CREATE INDEX "ItemGroup_TenantId_Status_idx" ON "ItemGroup"("TenantId", "Status");
CREATE INDEX "ItemGroup_TenantId_CreatedAt_idx" ON "ItemGroup"("TenantId", "CreatedAt");

ALTER TABLE "ItemGroup" ADD CONSTRAINT "ItemGroup_TenantId_fkey" FOREIGN KEY ("TenantId") REFERENCES "Tenant"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "ItemGroup" ("Id", "TenantId", "Code", "Name", "UpdatedAt")
SELECT gen_random_uuid()::text, g."TenantId",
       'IG' || lpad((row_number() OVER (PARTITION BY g."TenantId" ORDER BY g."Group"))::text, 4, '0'),
       g."Group", CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "TenantId", "Group" FROM "Product" WHERE "Group" IS NOT NULL AND btrim("Group") <> '') g;
