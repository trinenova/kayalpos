-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "PackSize" TEXT;

-- AlterTable
ALTER TABLE "SellingPrice" ADD COLUMN     "PreviousPrice" DECIMAL(12,2);
