-- 0002_message_length_cap.sql
-- Lower the message-length cap from 2000 to 320 chars to match the slide
-- layout — anything longer overflows the quote block in Cabinet Grotesk
-- Bold 64px.
--
-- Apply via: supabase db push, or paste into the SQL Editor.

alter table wins drop constraint if exists wins_message_length;

alter table wins
  add constraint wins_message_length
  check (char_length(btrim(message)) between 1 and 320);
