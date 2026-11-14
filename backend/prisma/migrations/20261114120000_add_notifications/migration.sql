-- Tenant-wide notifications + per-user read/dismiss state.
CREATE TABLE "Notification" (
    "Id" TEXT NOT NULL,
    "TenantId" TEXT NOT NULL,
    "Type" TEXT NOT NULL,
    "Category" TEXT NOT NULL,
    "Severity" TEXT NOT NULL DEFAULT 'info',
    "Title" TEXT NOT NULL,
    "Message" TEXT,
    "Link" TEXT,
    "DedupeKey" TEXT,
    "CreatedBy" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("Id")
);

CREATE TABLE "NotificationState" (
    "Id" TEXT NOT NULL,
    "NotificationId" TEXT NOT NULL,
    "UserId" TEXT NOT NULL,
    "ReadAt" TIMESTAMP(3),
    "DismissedAt" TIMESTAMP(3),
    CONSTRAINT "NotificationState_pkey" PRIMARY KEY ("Id")
);

CREATE UNIQUE INDEX "Notification_TenantId_DedupeKey_key" ON "Notification"("TenantId", "DedupeKey");
CREATE INDEX "Notification_TenantId_CreatedAt_idx" ON "Notification"("TenantId", "CreatedAt");
CREATE UNIQUE INDEX "NotificationState_NotificationId_UserId_key" ON "NotificationState"("NotificationId", "UserId");
CREATE INDEX "NotificationState_UserId_idx" ON "NotificationState"("UserId");

ALTER TABLE "NotificationState" ADD CONSTRAINT "NotificationState_NotificationId_fkey" FOREIGN KEY ("NotificationId") REFERENCES "Notification"("Id") ON DELETE CASCADE ON UPDATE CASCADE;
