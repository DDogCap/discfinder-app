-- STEP 1: Add RakerDiver to user_role enum
-- Run this FIRST and SEPARATELY in your Supabase SQL Editor
-- Wait for it to complete before running the next step

ALTER TYPE user_role ADD VALUE 'rakerdiver';
