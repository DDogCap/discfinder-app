# Found Disc Import Setup Guide

This guide walks you through importing found discs from your legacy Glide app into the DZDiscFinder application.

## Overview

The found disc import system allows you to:
- Import existing found disc records from your Glide app CSV export
- Preserve legacy data with mapping IDs for future reference
- Migrate images from Google Storage to Supabase Storage
- Import contact attempt history and communication logs
- Validate data integrity throughout the process

## Prerequisites

### 1. Database Migration
Run the found disc import migration to add required fields:

```sql
-- Run this in your Supabase SQL Editor
-- File: ADD_FOUND_DISC_IMPORT_FIELDS.sql
```

### 2. Dependencies
Install required Node.js packages:

```bash
npm install axios
```

### 3. Environment Setup
Ensure these environment variables are configured:

```bash
# .env.local
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key

# For import scripts (add to your environment)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. CSV Data File
Place your found discs CSV export at:
```
discfinder-app/external_data/found_discs.csv
```

## Import Process

### Step 1: Validate Data and Prerequisites

Run the comprehensive validation to check your setup:

```bash
npm run validate-found-discs
```

This will:
- Validate CSV data quality
- Check source mapping
- Verify database schema
- Provide recommendations

### Step 2: Test Import Process

Run the full test suite to verify everything works:

```bash
npm run test-full-import
```

This tests:
- Database connectivity
- CSV file structure
- Storage permissions
- Import functionality with sample data

### Step 3: Create Missing Sources (if needed)

If validation shows unmapped sources, create them:

```bash
npm run validate-found-discs -- --create-sources
```

### Step 4: Import Found Discs

Import the found disc records:

```bash
# Test with a few records first
npm run test-found-disc-import

# Import all records
npm run import-found-discs
```

### Step 5: Migrate Images

Download images from Google Storage and upload to Supabase:

```bash
# Test image migration
npm run test-image-migration

# Migrate all images
npm run migrate-disc-images

# Check migration status
npm run image-migration-status
```

### Step 6: Import Contact Attempts

Import communication history:

```bash
# Test contact import
npm run test-contact-import

# Import all contact attempts
npm run import-contact-attempts

# Check import status
npm run contact-attempts-status
```

## Available Scripts

### Validation and Testing
- `npm run validate-found-discs` - Run comprehensive validation
- `npm run test-full-import` - Test complete import process
- `npm run test-found-disc-import` - Test found disc import only

### Found Disc Import
- `npm run import-found-discs` - Import all found discs
- `npm run import-found-discs -- --test 5` - Test with 5 records

### Image Migration
- `npm run migrate-disc-images` - Migrate all images
- `npm run test-image-migration` - Test image migration
- `npm run image-migration-status` - Check migration progress

### Contact Attempts
- `npm run import-contact-attempts` - Import contact history
- `npm run test-contact-import` - Test contact import
- `npm run contact-attempts-status` - Check import status

### Source Management
- `npm run validate-found-discs -- --sources` - Analyze source mapping
- `npm run validate-found-discs -- --create-sources` - Create missing sources

## Data Mapping

### CSV Fields to Database Fields

| CSV Field | Database Field | Notes |
|-----------|----------------|-------|
| 🔒 Row ID | legacy_row_id | Primary mapping field |
| Description | description, brand, mold, color | Parsed for disc details |
| Disc Owner Phone | phone_number | Contact info on disc |
| Disc Owner Name | name_on_disc | Name written on disc |
| Disc Owner PDGA # | owner_pdga_number | PDGA number if available |
| SourceID | source_id | Mapped via sources.legacy_row_id |
| Entry Date | entry_date | When disc was entered |
| Entered By | entered_by_name | Who entered the disc |
| Returned Date | returned_at | When disc was returned |
| Returned By | returned_by_name | Who returned the disc |
| Image, Image2 | image_urls | Array of image URLs |
| Contact Notes | contact_attempts | Communication log |
| Initial Text Message Sent | contact_attempts | SMS history |
| Last Text Sent | contact_attempts | Recent communication |

### Return Status Mapping

| CSV Condition | Return Status |
|---------------|---------------|
| Has Returned Date | "Returned to Owner" |
| No Returned Date | "Found" |

## Troubleshooting

### Common Issues

**1. Missing Sources**
```bash
# Check which sources need to be created
npm run validate-found-discs -- --sources

# Create missing sources automatically
npm run validate-found-discs -- --create-sources
```

**2. Image Download Failures**
- Check internet connectivity
- Verify Google Storage URLs are accessible
- Check Supabase Storage permissions

**3. Database Connection Issues**
- Verify SUPABASE_SERVICE_ROLE_KEY is correct
- Check database permissions
- Ensure migrations are applied

**4. CSV Format Issues**
```bash
# Validate CSV data quality
npm run validate-found-discs -- --data
```

### Error Recovery

**Partial Import Failures**
- Scripts are designed to be re-runnable
- Existing records are skipped based on legacy_row_id
- Check error logs for specific issues

**Image Migration Issues**
- Failed images keep original URLs
- Re-run migration to retry failed downloads
- Check storage usage limits

## Data Validation

### Pre-Import Checks
- CSV file structure and required columns
- Source ID mapping completeness
- Data quality issues (duplicates, missing fields)
- Database schema compatibility

### Post-Import Verification
- Record count matching
- Image migration success rate
- Contact attempts linking
- Data integrity checks

## Performance Considerations

### Batch Processing
- Found discs: Processed individually with small delays
- Images: Processed in batches of 5 with 2-second delays
- Contact attempts: Processed with 100ms delays every 10 records

### Storage Limits
- Supabase Storage: Check usage after image migration
- Image size limit: 10MB per image
- Total storage: Monitor bucket usage

## Next Steps

After successful import:

1. **Verify Data**: Check admin dashboard for imported records
2. **Test Search**: Ensure search functionality works with imported data
3. **User Testing**: Test with real users to verify data accuracy
4. **Cleanup**: Remove test records if any were created
5. **Monitoring**: Set up monitoring for ongoing data integrity

## Support

If you encounter issues:

1. Check the error logs from the import scripts
2. Run validation scripts to identify specific problems
3. Review the troubleshooting section above
4. Check Supabase logs for database-related issues

## Files Created

- `ADD_FOUND_DISC_IMPORT_FIELDS.sql` - Database migration
- `import-found-discs.js` - Main import script
- `migrate-found-disc-images.js` - Image migration
- `import-contact-attempts.js` - Contact history import
- `validate-found-disc-import.js` - Validation and source management
- `test-found-disc-import.js` - Comprehensive test suite
