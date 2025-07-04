-- Update sources table to support legacy import
-- Add legacy_row_id field for mapping to external data

-- Add legacy_row_id column to sources table
ALTER TABLE sources
ADD COLUMN legacy_row_id TEXT UNIQUE;

-- Add index for legacy_row_id lookups
CREATE INDEX idx_sources_legacy_row_id ON sources(legacy_row_id);

-- Add comment for documentation
COMMENT ON COLUMN sources.legacy_row_id IS 'Legacy row ID from Glide app for import mapping';

-- Update the found_discs table to have a default for location_found
ALTER TABLE found_discs
ALTER COLUMN location_found SET DEFAULT 'Exact location unknown.';

-- Add comment for documentation
COMMENT ON COLUMN found_discs.location_found IS 'Specific location within the source. Defaults to "Exact location unknown." if not specified';



-- Grant necessary permissions for sources
GRANT SELECT ON sources TO authenticated;
GRANT ALL ON sources TO service_role;
