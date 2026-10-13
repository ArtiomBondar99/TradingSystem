-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "balance" DECIMAL(18,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets"("user_id");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Added manually: the database itself refuses a negative balance,
-- even if the application has a bug or two requests race.
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_balance_non_negative" CHECK ("balance" >= 0);

-- Added manually: give every user registered before this migration a wallet.
INSERT INTO "wallets" ("id", "user_id", "balance", "updated_at")
SELECT gen_random_uuid(), "id", 100000.00, CURRENT_TIMESTAMP
FROM "users";
