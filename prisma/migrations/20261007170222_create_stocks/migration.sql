-- CreateTable
CREATE TABLE "stocks" (
    "id" UUID NOT NULL,
    "symbol" VARCHAR(10) NOT NULL,
    "name" TEXT NOT NULL,
    "current_price" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stocks_symbol_key" ON "stocks"("symbol");

-- Added manually: a price must be positive, otherwise BUY math (price * quantity) breaks
ALTER TABLE "stocks" ADD CONSTRAINT "stocks_current_price_positive" CHECK ("current_price" > 0);

-- Added manually: symbols are stored uppercase only (AAPL, not aapl)
ALTER TABLE "stocks" ADD CONSTRAINT "stocks_symbol_uppercase" CHECK ("symbol" = upper("symbol"));
