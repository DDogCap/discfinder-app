# Sources System Setup Guide

## Overview

The Sources system provides a two-tier location structure for the DiscFinder app:
1. **Source** - General location/event (admin-managed dropdown)
2. **Specific Location** - Detailed location within the source (free text)

This helps organize found disc reports by providing consistent location categories while still allowing detailed location information.

## Database Schema

### Sources Table
```sql
CREATE TABLE sources (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    legacy_row_id TEXT UNIQUE, -- For import mapping
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);
```

### Found Discs Integration
- Added `source_id UUID REFERENCES sources(id)` to `found_discs` table
- Set `location_found` default to "Exact location unknown."
- Added `legacy_row_id` for mapping to external systems
- Updated views to include source information
- Maintains backward compatibility with existing data

## Setup Instructions

### 1. Run Database Migration

```bash
# Option 1: Using the migration script (requires SUPABASE_SERVICE_ROLE_KEY)
npm run migrate-sources

# Option 2: Manual migration via Supabase SQL Editor
# Copy contents of ADD_SOURCES_TABLE.sql and paste into SQL Editor
```

### 2. Update Sources Table for Import

```bash
# Add legacy_row_id column and set location_found default
npm run update-sources-table

# Or manually run UPDATE_SOURCES_FOR_IMPORT.sql in Supabase SQL Editor
```

### 3. Import Sources from CSV

```bash
# Import sources from external_data/sources.csv
npm run import-sources

# Check import status
npm run sources-status
```

### 4. Test the Implementation

```bash
# Test import functionality
npm run test-sources-import

# Check current sources status
npm run sources-status
```

### 3. Environment Variables

Add to your `.env.local` file (for migration script):
```
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## Features

### Admin Management
- **Create Sources** - Add new predefined locations/events
- **Edit Sources** - Update name, description, sort order
- **Active/Inactive** - Control visibility in dropdown
- **Sort Order** - Custom ordering in dropdown list

### User Experience
- **Required Selection** - Users must choose a source when reporting found discs
- **"Other" Option** - Always available fallback option (created by migration)
- **Specific Details** - Additional field for precise location within source

### Integration Points

#### Report Found Disc Form
- Source dropdown (required field)
- Specific location text field (required field)
- Loads active sources on component mount

#### Search Results
- Displays source name when available
- Shows "Specific Location" label for location_found field
- Maintains backward compatibility for discs without sources

#### Admin Dashboard
- Source information displayed in disc details
- "Manage Sources" button opens SourceManager modal
- Full CRUD operations for sources

## API Functions

### Frontend (supabaseService)
```typescript
// Get all sources (admin only sees inactive too)
getSources(): Promise<Source[]>

// Get active sources only (for dropdown)
getActiveSources(): Promise<Source[]>

// Create new source (admin only)
createSource(source: Omit<Source, 'id' | 'created_at' | 'updated_at'>): Promise<Source>

// Update existing source (admin only)
updateSource(id: string, updates: Partial<Source>): Promise<Source>

// Delete source (admin only)
deleteSource(id: string): Promise<void>
```

### Database Views
- `public_found_discs` - Includes `source_name` field
- `admin_found_discs` - Includes `source_name` field

## Sample Sources Data

The system comes with a default "Other" source. You can add sample sources like:

- Tournament events: "2021 DDO", "2022 Worlds", "2019 GBO"
- Local courses: "Lawrence, KS (Local)", "Jones, Emporia"
- Special locations: "Emporia, KS Ponds", "Centennial Birdie Bin"
- Fallback: "Unknown"

## Row Level Security

### Sources Table Policies
- **Read Active Sources** - Anyone can view active sources (for dropdown)
- **Read All Sources** - Only admins can view inactive sources
- **Insert/Update/Delete** - Only admins can modify sources

### Integration Security
- Source selection doesn't bypass existing found_discs RLS policies
- Source information visible based on user role (same as other disc details)

## Component Structure

### SourceManager.tsx
- Modal-based interface for admin source management
- Create, edit, activate/deactivate sources
- Responsive design with form validation
- Integrated into AdminDashboard

### Form Integration
- Added to ReportFound component
- Dropdown populated from active sources
- Required field validation
- Maintains existing form styling

## Troubleshooting

### Migration Issues
1. **Permission Errors** - Ensure SUPABASE_SERVICE_ROLE_KEY is correct
2. **Already Exists Errors** - Safe to ignore, indicates partial migration completed
3. **Manual Migration** - Copy SQL from ADD_SOURCES_TABLE.sql to Supabase SQL Editor

### Runtime Issues
1. **Empty Dropdown** - Check if sources exist and are active
2. **Permission Denied** - Verify RLS policies are applied correctly
3. **Missing Source Names** - Ensure views are updated with source joins

### Testing
```bash
# Verify table structure
npm run test-sources

# Create test data
npm run create-sample-sources

# Check in browser
# 1. Sign in as admin
# 2. Go to Admin Dashboard
# 3. Click "Manage Sources"
# 4. Try creating/editing sources
# 5. Go to Report Found Disc
# 6. Verify source dropdown appears
```

## Future Enhancements

- **Source Categories** - Group sources by type (tournaments, courses, etc.)
- **Source Statistics** - Track how many discs found per source
- **Bulk Import** - Import sources from CSV/spreadsheet
- **Source Descriptions** - Rich text descriptions with additional context
- **Geographic Integration** - Link sources to map coordinates

## Files Modified/Created

### Database
- `ADD_SOURCES_TABLE.sql` - Complete migration script

### Frontend
- `src/lib/supabase.ts` - Added Source interface and supabaseService
- `src/components/SourceManager.tsx` - Admin management interface
- `src/App.tsx` - Integrated source dropdown and admin button
- `src/App.css` - Added styling for form elements

### Scripts
- `run-sources-migration.js` - Automated migration runner
- `test-sources.js` - Testing and sample data creation
- `package.json` - Added npm scripts

### Documentation
- `PROJECT_CONTEXT.md` - Updated with sources information
- `SOURCES_SETUP.md` - This comprehensive setup guide
