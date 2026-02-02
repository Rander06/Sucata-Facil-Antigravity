-- Use TRUNCATE to clear the table. 
-- This command does not require a primary key and is faster than DELETE.
TRUNCATE TABLE public.wallet_transactions_backup_encoding;

-- Optional: If you want to enable individual row deletion in the UI in the future,
-- you should add a primary key. Uncomment the lines below to add one:
-- ALTER TABLE public.wallet_transactions_backup_encoding ADD COLUMN id SERIAL PRIMARY KEY;
