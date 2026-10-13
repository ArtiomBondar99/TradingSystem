-- AlterEnum
ALTER TYPE "OrderType" ADD VALUE 'STOP';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "fee" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "stop_price" DECIMAL(18,2);

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "fee" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- Hand-written: defence in depth behind the DTO validation
ALTER TABLE "orders" ADD CONSTRAINT "orders_stop_price_positive"
  CHECK ("stop_price" IS NULL OR "stop_price" > 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_fee_not_negative" CHECK ("fee" >= 0);
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_fee_not_negative" CHECK ("fee" >= 0);
