-- 058_ticket_description_optional.sql
--
-- Admins can write a known issue or a roadmap item straight onto the board,
-- and one of those is often just a title. A report from staff or a parent
-- still has to say something; the route enforces that, not the table.

ALTER TABLE public.feedback_tickets ALTER COLUMN description DROP NOT NULL;
