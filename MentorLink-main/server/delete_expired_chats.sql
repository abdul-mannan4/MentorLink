-- Run this in your Supabase Dashboard > SQL Editor
-- This function deletes chats, messages, and requests older than 3 days.
-- It executes as SECURITY DEFINER to bypass RLS policies on tables.

CREATE OR REPLACE FUNCTION delete_expired_chats()
RETURNS VOID
SECURITY DEFINER
AS $$
DECLARE
  expired_chat_record RECORD;
BEGIN
  -- Loop through all chats that have no activity in the last 3 days
  FOR expired_chat_record IN (
    SELECT chat_id, request_id, student_id, mentor_id
    FROM chat c
    WHERE NOT EXISTS (
      SELECT 1 FROM message m
      WHERE m.chat_id = c.chat_id
      AND m.sent_at >= NOW() - INTERVAL '3 days'
    )
    AND c.created_at < NOW() - INTERVAL '3 days'
  ) LOOP
    -- 1. Delete messages belonging to this chat
    DELETE FROM message WHERE chat_id = expired_chat_record.chat_id;
    
    -- 2. Delete the chat itself
    DELETE FROM chat WHERE chat_id = expired_chat_record.chat_id;
    
    -- 3. Delete the associated chat_request
    IF expired_chat_record.request_id IS NOT NULL THEN
      DELETE FROM chat_request WHERE request_id = expired_chat_record.request_id;
    ELSE
      DELETE FROM chat_request 
      WHERE student_id = expired_chat_record.student_id 
        AND mentor_id = expired_chat_record.mentor_id;
    END IF;
  END LOOP;

  -- Also delete any pending, rejected, or cancelled requests older than 3 days
  DELETE FROM chat_request
  WHERE created_at < NOW() - INTERVAL '3 days'
    AND status IN ('pending', 'rejected', 'cancelled');
END;
$$ LANGUAGE plpgsql;

-- Grant execution permission to the anonymous, authenticated, and service_role
GRANT EXECUTE ON FUNCTION delete_expired_chats() TO anon, authenticated, service_role;
