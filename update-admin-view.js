const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateAdminView() {
  console.log('Updating admin_found_discs view to include contact attempt counts...');

  try {
    // Drop and recreate the admin view with contact attempt counts
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        -- Update the admin view to include new fields and contact attempt counts
        DROP VIEW IF EXISTS admin_found_discs;
        CREATE OR REPLACE VIEW admin_found_discs AS
        SELECT
            fd.*,
            s.name as source_name,
            p.email as finder_email,
            p.full_name as finder_name,
            eb.email as entered_by_email,
            eb.full_name as entered_by_full_name,
            rb.email as returned_by_email,
            rb.full_name as returned_by_full_name,
            COALESCE(ca.contact_count, 0) as contact_attempts_count,
            ca.last_contact_date,
            ca.last_contact_method
        FROM found_discs fd
        LEFT JOIN sources s ON fd.source_id = s.id
        LEFT JOIN profiles p ON fd.finder_id = p.id
        LEFT JOIN profiles eb ON fd.entered_by_profile_id = eb.id
        LEFT JOIN profiles rb ON fd.returned_by_profile_id = rb.id
        LEFT JOIN (
            SELECT 
                found_disc_id,
                COUNT(*) as contact_count,
                MAX(attempted_at) as last_contact_date,
                (SELECT contact_method FROM contact_attempts ca2 
                 WHERE ca2.found_disc_id = ca1.found_disc_id 
                 ORDER BY attempted_at DESC LIMIT 1) as last_contact_method
            FROM contact_attempts ca1
            GROUP BY found_disc_id
        ) ca ON fd.id = ca.found_disc_id
        WHERE get_user_role() = 'admin'
        ORDER BY
            CASE fd.return_status
                WHEN 'Found' THEN 1
                ELSE 2
            END,
            fd.created_at DESC;
      `
    });

    if (error) {
      console.error('Error updating admin view:', error);
      return;
    }

    console.log('✅ Admin view updated successfully!');
    console.log('The admin dashboard will now show contact attempt counts for each disc.');

  } catch (error) {
    console.error('Error updating admin view:', error);
  }
}

// Check if exec_sql function exists, if not create a simpler approach
async function checkAndUpdate() {
  try {
    // Try the direct SQL approach first
    await updateAdminView();
  } catch (error) {
    console.log('Direct SQL approach failed, trying alternative...');
    
    // Alternative: Use individual queries
    try {
      // Drop the view
      await supabase.rpc('exec_sql', { sql: 'DROP VIEW IF EXISTS admin_found_discs;' });
      
      // Create the new view
      const createViewSQL = `
        CREATE OR REPLACE VIEW admin_found_discs AS
        SELECT
            fd.*,
            s.name as source_name,
            p.email as finder_email,
            p.full_name as finder_name,
            eb.email as entered_by_email,
            eb.full_name as entered_by_full_name,
            rb.email as returned_by_email,
            rb.full_name as returned_by_full_name,
            COALESCE(ca.contact_count, 0) as contact_attempts_count,
            ca.last_contact_date,
            ca.last_contact_method
        FROM found_discs fd
        LEFT JOIN sources s ON fd.source_id = s.id
        LEFT JOIN profiles p ON fd.finder_id = p.id
        LEFT JOIN profiles eb ON fd.entered_by_profile_id = eb.id
        LEFT JOIN profiles rb ON fd.returned_by_profile_id = rb.id
        LEFT JOIN (
            SELECT 
                found_disc_id,
                COUNT(*) as contact_count,
                MAX(attempted_at) as last_contact_date,
                (SELECT contact_method FROM contact_attempts ca2 
                 WHERE ca2.found_disc_id = ca1.found_disc_id 
                 ORDER BY attempted_at DESC LIMIT 1) as last_contact_method
            FROM contact_attempts ca1
            GROUP BY found_disc_id
        ) ca ON fd.id = ca.found_disc_id
        WHERE get_user_role() = 'admin'
        ORDER BY
            CASE fd.return_status
                WHEN 'Found' THEN 1
                ELSE 2
            END,
            fd.created_at DESC;
      `;
      
      await supabase.rpc('exec_sql', { sql: createViewSQL });
      console.log('✅ Admin view updated successfully using alternative method!');
      
    } catch (altError) {
      console.error('Alternative approach also failed:', altError);
      console.log('You may need to run the SQL manually in your Supabase dashboard.');
    }
  }
}

if (require.main === module) {
  checkAndUpdate();
}

module.exports = { updateAdminView };
