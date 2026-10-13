-- AlterEnum
ALTER TYPE "OrderType" ADD VALUE 'LIMIT';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "limit_price" DECIMAL(18,2);

-- CreateIndex
CREATE INDEX "orders_status_stock_id_idx" ON "orders"("status", "stock_id");

-- Hand-written: a limit price, when there is one, must be positive. Defence in
-- depth behind the DTO validation. (It can't also say "LIMIT orders need a
-- limit_price": Postgres won't use an enum value added in the same migration.)
ALTER TABLE "orders" ADD CONSTRAINT "orders_limit_price_positive"
  CHECK ("limit_price" IS NULL OR "limit_price" > 0);
