-- Decimal quantities for Line Sale (e.g. 0.5 Kg, 250 Gram): stock on hand and
-- held-bill line quantities were whole numbers (INTEGER). Widen to
-- DECIMAL(14,3) — the same precision ProductLot.QtyRemaining already uses.
-- Existing whole-number values convert losslessly (12 -> 12.000).

ALTER TABLE "Product" ALTER COLUMN "AvailableQty" DROP DEFAULT;
ALTER TABLE "Product" ALTER COLUMN "AvailableQty" TYPE DECIMAL(14,3) USING "AvailableQty"::DECIMAL(14,3);
ALTER TABLE "Product" ALTER COLUMN "AvailableQty" SET DEFAULT 0;

ALTER TABLE "HeldBillLine" ALTER COLUMN "Qty" TYPE DECIMAL(14,3) USING "Qty"::DECIMAL(14,3);
