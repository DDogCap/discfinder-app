# Supabase Setup Guide for DZDiscFinder

## Quick Setup (5 minutes)

### 1. Create a Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project" and sign up/login
3. Click "New Project"
4. Choose your organization
5. Enter project name: `dzdiscfinder`
6. Enter a strong database password
7. Choose a region close to you
8. Click "Create new project"

### 2. Get Your Project Credentials
1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy the **Project URL** (looks like: `https://abcdefgh.supabase.co`)
3. Copy the **anon public** key (long string starting with `eyJ...`)

### 3. Configure Your App
1. Open `discfinder-app/.env.local`
2. Replace the placeholder values:
```
REACT_APP_SUPABASE_URL=https://your-actual-project-url.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-actual-anon-key-here
```

### 4. Set Up the Database
1. In Supabase dashboard, go to **SQL Editor**
2. Click "New query"
3. Copy and paste the entire contents of `supabase/migrations/20250612051815_create_found_discs_schema.sql`
4. Click "Run" to execute the SQL

### 5. Test the Connection
1. Restart your React app: `npm start`
2. Go to "Report Found" and fill out the form
3. Submit the form
4. Check Supabase dashboard → **Table Editor** → **found_discs** to see your data!

## What's Included

The database schema includes:
- **found_discs** - Store reported found discs
- **lost_discs** - Store reported lost discs  
- **profiles** - User profiles
- **disc_matches** - Automatic matching system
- **contact_attempts** - Communication tracking

## Features Ready to Use

✅ **Report Found Disc** - Fully functional with Supabase integration
✅ **Automatic matching** - Database functions will match lost/found discs
✅ **User authentication** - Ready for Supabase Auth
✅ **Row Level Security** - Data protection built-in

## Next Steps

After setup, you can:
1. Test the found disc reporting
2. Implement the search functionality
3. Add user authentication
4. Build the matching system UI

## Troubleshooting

**"Demo Mode" message?**
- Check your `.env.local` file has correct credentials
- Restart the React app after changing environment variables
- Verify the database schema was created in Supabase

**Database errors?**
- Make sure you ran the SQL migration in Supabase
- Check the SQL Editor for any error messages
- Verify your project URL and API key are correct
