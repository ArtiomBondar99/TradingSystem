-- CreateEnum
CREATE TYPE "OrderSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('MARKET');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'FILLED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('BUY', 'SELL');

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "stock_id" UUID NOT NULL,
    "side" "OrderSide" NOT NULL,
    "type" "OrderType" NOT NULL DEFAULT 'MARKET',
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(18,2),
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "reject_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executed_at" TIMESTAMP(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "stock_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "average_price" DECIMAL(18,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "stock_id" UUID NOT NULL,
    "type" "TransactionType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(18,2) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "positions_user_id_stock_id_key" ON "positions"("user_id", "stock_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_order_id_key" ON "transactions"("order_id");

-- CreateIndex
CREATE INDEX "transactions_user_id_created_at_idx" ON "transactions"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_stock_id_fkey" FOREIGN KEY ("stock_id") REFERENCES "stocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_stock_id_fkey" FOREIGN KEY ("stock_id") REFERENCES "stocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_stock_id_fkey" FOREIGN KEY ("stock_id") REFERENCES "stocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Added manually: business rules enforced by the database itself, so even a
-- bug in the application can't store impossible data.
-- ============================================================================

-- Orders: positive quantity; a FILLED order must have a price and an execution time
ALTER TABLE "orders" ADD CONSTRAINT "orders_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_price_positive" CHECK ("price" IS NULL OR "price" > 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_filled_has_execution"
  CHECK ("status" <> 'FILLED' OR ("price" IS NOT NULL AND "executed_at" IS NOT NULL));

-- Positions: you can never hold a negative number of shares
ALTER TABLE "positions" ADD CONSTRAINT "positions_quantity_non_negative" CHECK ("quantity" >= 0);
ALTER TABLE "positions" ADD CONSTRAINT "positions_average_price_non_negative" CHECK ("average_price" >= 0);

-- Transactions: amount must be exactly price * quantity
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_price_positive" CHECK ("price" > 0);
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_amount_matches"
  CHECK ("amount" = "price" * "quantity");

-- Transactions are an audit trail: once written, they can never change or disappear
CREATE FUNCTION prevent_transaction_changes() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'transactions are immutable (audit trail): % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transactions_immutable
  BEFORE UPDATE OR DELETE ON "transactions"
  FOR EACH ROW EXECUTE FUNCTION prevent_transaction_changes();
