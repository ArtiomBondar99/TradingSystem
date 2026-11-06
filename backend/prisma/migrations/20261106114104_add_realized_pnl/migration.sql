-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "realized_pnl" DECIMAL(18,2);

-- Hand-written: backfill the sales made before this column existed.
-- Replays each user's trades of each stock in order, with the same average
-- cost rules as OrdersService (weighted average on BUY, 4 decimals; a SELL
-- keeps the average; selling everything starts over at the next BUY).
--
-- transactions is an immutable audit trail (trigger transactions_immutable).
-- This one-time migration is the only place allowed to fill in the new
-- column: the trigger is off only while it runs.
ALTER TABLE "transactions" DISABLE TRIGGER "transactions_immutable";

DO $$
DECLARE
  t           RECORD;
  held        INTEGER := 0;
  avg_price   NUMERIC := 0;
  last_user   UUID;
  last_stock  UUID;
BEGIN
  -- id is a UUIDv7 (time-ordered): a stable tie-breaker for equal created_at
  FOR t IN
    SELECT "id", "user_id", "stock_id", "type", "quantity", "price", "fee"
    FROM "transactions"
    ORDER BY "user_id", "stock_id", "created_at", "id"
  LOOP
    IF t."user_id" IS DISTINCT FROM last_user
       OR t."stock_id" IS DISTINCT FROM last_stock THEN
      held := 0;
      avg_price := 0;
      last_user := t."user_id";
      last_stock := t."stock_id";
    END IF;

    IF t."type" = 'BUY' THEN
      avg_price := CASE
        WHEN held = 0 THEN t."price"
        ELSE round((avg_price * held + t."price" * t."quantity") / (held + t."quantity"), 4)
      END;
      held := held + t."quantity";
    ELSE
      UPDATE "transactions"
      SET "realized_pnl" = round((t."price" - avg_price) * t."quantity" - t."fee", 2)
      WHERE "id" = t."id";
      held := held - t."quantity";
    END IF;
  END LOOP;
END $$;

ALTER TABLE "transactions" ENABLE TRIGGER "transactions_immutable";

-- Every SELL has it, no BUY has it
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_realized_pnl_sell_only"
  CHECK (("type" = 'SELL') = ("realized_pnl" IS NOT NULL));
