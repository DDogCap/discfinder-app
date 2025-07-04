# RakerDiver Role Setup Guide

This guide explains how to set up and use the new RakerDiver role and bulk turn-in functionality in the DiscFinder app.

## 🎯 What is a RakerDiver?

A RakerDiver is a special user role for people who collect discs in bulk from ponds, lakes, or other water hazards. They need to:
- Record when and where they collected discs
- Track how many discs they turned in and where
- Get paid for their work
- Have their activities verified by admins

## 🗄️ Database Setup

**IMPORTANT**: Run these SQL scripts in your Supabase SQL Editor **in this exact order**:

### 1. Add RakerDiver Enum Value (FIRST)
```sql
-- Run this file FIRST: STEP1_ADD_RAKERDIVER_ENUM.sql
-- Wait for it to complete before proceeding
```

### 2. Add Tables and Policies (SECOND)
```sql
-- Run this file SECOND: ADD_RAKERDIVER_ROLE.sql
-- Only after step 1 is complete
```

### 3. Add Database Functions (THIRD)
```sql
-- Run this file THIRD: BULK_TURNIN_FUNCTIONS.sql
-- Only after step 2 is complete
```

**Why separate steps?** PostgreSQL requires enum values to be committed before they can be used in table definitions.

## 👤 User Role Management

### Creating a RakerDiver User

1. **User signs up normally** through the app
2. **Admin updates their role** in Supabase:
   ```sql
   UPDATE profiles 
   SET role = 'rakerdiver' 
   WHERE email = 'rakerdiver@example.com';
   ```

### Role Capabilities

| Role | Can Do |
|------|--------|
| **RakerDiver** | • All user capabilities<br>• Create bulk turn-in records<br>• View their own turn-ins and payments<br>• Confirm payment receipt |
| **Admin** | • All RakerDiver capabilities<br>• Verify bulk turn-ins<br>• Create payment records<br>• View all turn-ins |

## 🎮 Using the RakerDiver Dashboard

### For RakerDivers

1. **Sign in** to the app
2. **Click "RakerDiver"** in the navigation (only visible to RakerDivers)
3. **Record a new turn-in:**
   - Click "Record New Turn-In"
   - Fill in collection details (where, when, how many discs)
   - Fill in turn-in details (where you delivered them, when)
   - Add optional notes
   - Submit

4. **View your records:**
   - See all your turn-in records
   - Check verification status
   - View payment summary
   - Click "View Payments" to see payment details

5. **Confirm payments:**
   - When admin creates a payment record
   - Click "Confirm Receipt" to acknowledge you received payment

### For Admins

1. **Access bulk turn-in management:**
   - Go to Admin Dashboard
   - Click "Manage Bulk Turn-Ins"

2. **Verify turn-ins:**
   - Review pending turn-ins
   - Add verification notes (optional)
   - Click "Verify Turn-In"

3. **Create payment records:**
   - Click "Manage Payments" on any turn-in
   - Click "Add Payment"
   - Enter amount, payment method, date, notes
   - Submit payment record

4. **Track payment status:**
   - See if RakerDiver has confirmed receipt
   - View payment history for each turn-in

## 📊 Data Structure

### Bulk Turn-In Record
- **Collection Info:** Location, date, time, disc count
- **Turn-In Info:** Where delivered, date, time
- **Status:** Pending verification → Verified by admin
- **Notes:** Additional details

### Payment Record
- **Amount:** Payment amount in USD
- **Method:** Cash, Venmo, PayPal, etc.
- **Date:** When payment was made
- **Status:** Created by admin → Confirmed by RakerDiver

## 🔄 Typical Workflow

1. **RakerDiver** goes to Jones East North Pond, collects 20 discs
2. **RakerDiver** delivers discs to L&F Booth in Emporia
3. **RakerDiver** creates turn-in record in app
4. **Admin** receives discs, verifies the turn-in record
5. **Admin** creates payment record (e.g., $40 for 20 discs)
6. **Admin** pays RakerDiver via chosen method
7. **RakerDiver** confirms payment receipt in app

## 🎨 UI Features

### RakerDiver Dashboard
- Clean, card-based layout for turn-in records
- Status badges (Pending/Verified)
- Payment summaries with confirmed vs total amounts
- Modal for viewing payment details
- Form for creating new turn-ins

### Admin Management
- Filter turn-ins by verification status
- Bulk verification with notes
- Payment management modal
- Payment history tracking
- RakerDiver contact information

## 🔧 Technical Details

### Database Tables
- `bulk_turnins` - Main turn-in records
- `bulk_turnin_payments` - Payment tracking

### Key Functions
- `create_bulk_turnin()` - RakerDiver creates record
- `verify_bulk_turnin()` - Admin verifies
- `create_bulk_turnin_payment()` - Admin creates payment
- `confirm_payment_receipt()` - RakerDiver confirms

### Security
- Row Level Security (RLS) policies
- Role-based access control
- Users can only see their own data
- Admins can see everything

## 🚀 Getting Started

1. Run the SQL setup scripts
2. Create a test RakerDiver user
3. Test the workflow:
   - Create a turn-in record
   - Verify it as admin
   - Create a payment
   - Confirm payment as RakerDiver

## 💡 Future Enhancements

- Automatic payment calculation based on disc count
- Photo uploads for turn-in verification
- Reporting and analytics
- Bulk operations for admins
- Email notifications for status changes
