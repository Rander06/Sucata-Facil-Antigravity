DO $$
BEGIN
    -- Check if policy exists to avoid error on re-run
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'wallet_transactions_backup_encoding'
          AND policyname = 'allow_all_for_service_role'
    ) THEN
        CREATE POLICY "allow_all_for_service_role"
        ON public.wallet_transactions_backup_encoding
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
        
        RAISE NOTICE 'Created policy allow_all_for_service_role on public.wallet_transactions_backup_encoding';
    ELSE
        RAISE NOTICE 'Policy allow_all_for_service_role already exists on public.wallet_transactions_backup_encoding';
    END IF;

    -- Ensure RLS is enabled
    ALTER TABLE public.wallet_transactions_backup_encoding ENABLE ROW LEVEL SECURITY;
END $$;
