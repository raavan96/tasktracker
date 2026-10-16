DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notifications' AND policyname = 'notifications_delete'
  ) THEN
    CREATE POLICY notifications_delete ON notifications FOR DELETE TO authenticated USING(user_id = auth.uid());
  END IF;
END $$;
