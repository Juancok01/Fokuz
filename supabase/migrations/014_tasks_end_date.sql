-- Migration: Add end_date to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS end_date date;

-- Add comment
COMMENT ON COLUMN public.tasks.end_date IS 'Optional end date / due date for the task, primarily for calendar view.';
