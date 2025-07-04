# Authentication Setup Guide

## 🔐 Role-Based Authentication System

Your DiscFinder app now has a complete authentication system with three user levels:

- **👤 Guests** - Can search discs but see limited information
- **🔑 Users** - Can report found discs and see full details  
- **👑 Admin** - Full access to all features and data

## 🚀 Setup Instructions

### 1. Run the Authentication SQL
1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy and paste the contents of `AUTH_SETUP.sql`
3. **IMPORTANT**: Replace `your-admin-email@example.com` with your actual email in TWO places:
   - Line 12: `-- UPDATE profiles SET role = 'admin' WHERE email = 'your-actual-email@example.com';`
   - Line 25: `WHEN NEW.email = 'your-actual-email@example.com' THEN 'admin'::user_role`
4. Click **"Run"** to execute the SQL

### 2. Enable Email Authentication in Supabase
1. Go to **Authentication** → **Settings** in your Supabase dashboard
2. Make sure **Enable email confirmations** is turned ON
3. Configure your email templates if desired

### 3. Test the System
1. **As a Guest**: Visit the app without signing in
   - Try searching - you'll see basic disc info only
   - Try reporting a disc - you'll be prompted to sign in

2. **Create a User Account**: 
   - Click "Sign In" → "Sign Up" tab
   - Create an account with any email (not your admin email)
   - You'll be a regular user with full access

3. **Create Admin Account**:
   - Sign up with the email you specified in the SQL
   - You'll automatically become an admin

## 🔍 What Each Role Can Do

### 👤 Guests (Not Signed In)
- ✅ Search for discs
- ✅ See basic disc information (brand, model, color, location, date)
- ❌ Cannot see phone numbers, names on discs, or detailed descriptions
- ❌ Cannot report found discs
- ❌ Cannot contact disc finders

### 🔑 Users (Signed In)
- ✅ Everything guests can do
- ✅ See full disc details including contact information
- ✅ Report found discs
- ✅ Contact disc finders (when implemented)
- ✅ Manage their own reports

### 👑 Admin (You)
- ✅ Everything users can do
- ✅ Manage all disc reports
- ✅ Access admin features (when implemented)
- ✅ Moderate content and resolve disputes

## 🎯 Test It Now

1. **Open your app** at `http://localhost:3000`
2. **Notice the "Sign In" button** in the navigation
3. **Try searching as a guest** - limited information shown
4. **Sign up for an account** - full information revealed
5. **Sign up with your admin email** - you'll see "(admin)" in the navigation

## 🔧 Technical Details

- **Row Level Security (RLS)** protects sensitive data
- **Public view** (`public_found_discs`) automatically filters data based on user role
- **Automatic user creation** when someone signs up
- **Role assignment** happens automatically based on email
- **JWT tokens** handle authentication securely

## 🚀 Next Steps

With authentication working, you can now:
- Implement contact/messaging between users
- Add user dashboards
- Build admin management features
- Add email notifications
- Implement the automatic matching system

The foundation is solid and secure! 🎉
