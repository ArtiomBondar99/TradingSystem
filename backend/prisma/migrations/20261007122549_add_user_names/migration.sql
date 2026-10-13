-- Adding required columns to a table that already has rows is a 3-step change.
-- Prisma's default (ADD COLUMN ... NOT NULL) would fail on existing users.

-- Step 1: add the columns as nullable, so existing rows are allowed
ALTER TABLE "users"
ADD COLUMN "first_name" TEXT,
ADD COLUMN "last_name" TEXT;

-- Step 2: backfill users registered before names were collected
UPDATE "users"
SET "first_name" = 'Unknown',
    "last_name" = 'Unknown'
WHERE "first_name" IS NULL;

-- Step 3: now that every row has a value, enforce NOT NULL
ALTER TABLE "users"
ALTER COLUMN "first_name" SET NOT NULL,
ALTER COLUMN "last_name" SET NOT NULL;
