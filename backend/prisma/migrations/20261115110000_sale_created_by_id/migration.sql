-- Which login account rang up each Line Sale bill, so non-admin users only see their own.
ALTER TABLE "Linesales" ADD COLUMN "CreatedById" TEXT;
CREATE INDEX "Linesales_TenantId_CreatedById_idx" ON "Linesales"("TenantId", "CreatedById");
