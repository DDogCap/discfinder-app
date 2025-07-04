-- Check and Update Admin Roles
-- Run this in your Supabase SQL Editor to check current user roles and update admin access

-- First, let's see all current users and their roles
SELECT 
    id,
    email,
    full_name,
    role,
    created_at
FROM profiles 
ORDER BY created_at DESC;

-- Check if your other employee exists in the profiles table
-- Replace 'other-employee@email.com' with their actual email
SELECT 
    id,
    email,
    full_name,
    role,
    created_at
FROM profiles 
WHERE email = 'other-employee@email.com';

-- Update your other employee to admin role
-- Replace 'other-employee@email.com' with their actual email
UPDATE profiles 
SET 
    role = 'admin',
    updated_at = NOW()
WHERE email = 'other-employee@email.com';

-- Verify the update worked
SELECT 
    id,
    email,
    full_name,
    role,
    updated_at
FROM profiles 
WHERE email = 'other-employee@email.com';

-- Show all admin users
SELECT 
    id,
    email,
    full_name,
    role,
    created_at,
    updated_at
FROM profiles 
WHERE role = 'admin'
ORDER BY created_at;
