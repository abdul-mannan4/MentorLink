-- Run this in your Supabase Dashboard > SQL Editor
-- This function allows the backend server to check if an email exists in auth.users (bypassing user enumeration protection limits)

CREATE OR REPLACE FUNCTION check_email_exists(email_to_check TEXT)
RETURNS BOOLEAN
SECURITY DEFINER -- Bypasses RLS to search auth.users schema
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE email = email_to_check 
      AND email_confirmed_at IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql;

-- Grant execution permission to the anonymous role (used by backend API requests)
GRANT EXECUTE ON FUNCTION check_email_exists(TEXT) TO anon, authenticated, service_role;
