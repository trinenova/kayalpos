-- CreateTable
CREATE TABLE "Role" (
    "Id" TEXT NOT NULL,
    "TenantId" TEXT NOT NULL,
    "Name" TEXT NOT NULL,
    "Description" TEXT,
    "Permissions" JSONB NOT NULL DEFAULT '{}',
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "CreatedBy" TEXT,
    "UpdatedBy" TEXT,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("Id")
);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "RoleId" TEXT;

-- CreateIndex
CREATE INDEX "Role_TenantId_idx" ON "Role"("TenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_TenantId_Name_key" ON "Role"("TenantId", "Name");

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_TenantId_fkey" FOREIGN KEY ("TenantId") REFERENCES "Tenant"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_RoleId_fkey" FOREIGN KEY ("RoleId") REFERENCES "Role"("Id") ON DELETE SET NULL ON UPDATE CASCADE;
