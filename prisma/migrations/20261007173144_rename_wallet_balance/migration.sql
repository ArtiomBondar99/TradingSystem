-- Written by hand. Prisma can't tell a rename from "drop + add", so it generated:
--   ALTER TABLE "wallets" DROP COLUMN "balance", ADD COLUMN "cash_balance" ...
-- which would delete every user's balance. RENAME keeps the data.

ALTER TABLE "wallets" RENAME COLUMN "balance" TO "cash_balance";

-- PostgreSQL updates the CHECK automatically; rename it so its name matches the column
ALTER TABLE "wallets"
RENAME CONSTRAINT "wallets_balance_non_negative" TO "wallets_cash_balance_non_negative";
