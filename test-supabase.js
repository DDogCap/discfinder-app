// Quick test script to check Supabase connection
// Run this in browser console to test connection

const testSupabaseConnection = async () => {
  console.log('Testing Supabase connection...');
  
  // Check environment variables
  console.log('SUPABASE_URL:', process.env.REACT_APP_SUPABASE_URL);
  console.log('SUPABASE_ANON_KEY exists:', !!process.env.REACT_APP_SUPABASE_ANON_KEY);
  
  try {
    // Test basic connection
    const { data, error } = await supabase.from('found_discs').select('count').limit(1);
    
    if (error) {
      console.error('Supabase connection error:', error);
      return false;
    }
    
    console.log('Supabase connection successful!');
    return true;
  } catch (err) {
    console.error('Supabase test failed:', err);
    return false;
  }
};

// Run the test
testSupabaseConnection();
