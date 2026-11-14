-- Outlet an event happened in (NULL = tenant-wide).
ALTER TABLE "Notification" ADD COLUMN "OutletId" TEXT;
CREATE INDEX "Notification_TenantId_OutletId_idx" ON "Notification"("TenantId", "OutletId");
