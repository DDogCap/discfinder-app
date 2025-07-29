import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://demo.supabase.co'
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'demo-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export type UserRole = 'guest' | 'user' | 'admin' | 'rakerdiver';

export interface Profile {
  id: string
  email: string
  full_name?: string
  phone?: string
  role?: UserRole
  created_at: string
  updated_at: string
  // New fields for import and enhanced functionality
  legacy_row_id?: string
  pdga_number?: number
  facebook_profile?: string
  instagram_handle?: string
  sms_number?: string
  phone_number?: string
  avatar_url?: string
  default_source_id?: string
}

export type ReturnStatus = 'Found' | 'Returned to Owner' | 'Donated' | 'Sold' | 'Trashed' | 'For Sale Used';

export interface ContactAttempt {
  id: string;
  found_disc_id: string;
  attempted_at: string;
  contact_method: string;
  message_content: string;
  attempted_by_profile_id?: string;
  attempted_by_name?: string;
  response_received: boolean;
  response_content?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Source {
  id: string
  name: string
  description?: string
  is_active: boolean
  sort_order: number
  legacy_row_id?: string
  msg1_found_just_entered?: string
  msg2_reminder?: string
  created_at: string
  updated_at: string
  created_by?: string
  updated_by?: string
}

export type DiscCondition = 'excellent' | 'good' | 'fair' | 'poor'
export type DiscType = 'putter' | 'approach' | 'midrange' | 'fairway_driver' | 'distance_driver'

export interface FoundDisc {
  id: string
  finder_id: string
  rack_id?: number
  brand: string
  mold?: string
  disc_type?: DiscType
  color: string
  weight?: number
  condition?: DiscCondition
  plastic_type?: string
  stamp_text?: string
  phone_number?: string
  name_on_disc?: string
  location_found: string
  location_coordinates?: { x: number; y: number }
  source_id?: string
  source_name?: string
  found_date: string
  description?: string
  image_urls?: string[]
  status: 'active' | 'claimed' | 'expired' | 'spam'
  return_status?: ReturnStatus
  returned_at?: string
  returned_notes?: string
  created_at: string
  updated_at: string
}

export interface LostDisc {
  id: string
  owner_id: string
  brand: string
  model?: string
  disc_type?: 'driver' | 'fairway_driver' | 'midrange' | 'putter' | 'approach' | 'distance_driver'
  color: string
  weight?: number
  plastic_type?: string
  stamp_text?: string
  location_lost: string
  location_coordinates?: { x: number; y: number }
  lost_date: string
  description?: string
  reward_offered?: number
  contact_preference: string
  status: 'active' | 'claimed' | 'expired' | 'spam'
  created_at: string
  updated_at: string
}

export interface BulkTurnin {
  id: string
  rakerdiver_id: string
  location_collected: string
  collection_date: string
  collection_time?: string
  disc_count: number
  turnin_location: string
  turnin_date: string
  turnin_time?: string
  notes?: string
  admin_verified: boolean
  verified_by?: string
  verified_at?: string
  verification_notes?: string
  created_at: string
  updated_at: string
  total_payments?: number
  confirmed_payments?: number
}

export interface BulkTurninPayment {
  id: string
  bulk_turnin_id: string
  amount: number
  payment_method?: string
  payment_date?: string
  payment_notes?: string
  created_by: string
  rakerdiver_confirmed: boolean
  confirmed_at?: string
  created_at: string
  updated_at: string
}

export interface AdminBulkTurnin extends BulkTurnin {
  rakerdiver_name?: string
  rakerdiver_email?: string
  verified_by_name?: string
  payment_count?: number
}

export interface DiscMatch {
  id: string
  found_disc_id: string
  lost_disc_id: string
  match_score: number
  status: 'potential' | 'confirmed' | 'rejected'
  finder_contacted_at?: string
  owner_contacted_at?: string
  created_at: string
  updated_at: string
  found_disc?: FoundDisc
  lost_disc?: LostDisc
}

// Helper functions for database operations
export const discService = {
  // Ensure demo user exists
  async ensureDemoUser() {
    const demoUserId = '00000000-0000-0000-0000-000000000000';
    try {
      // Check if demo user exists
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', demoUserId)
        .single();

      if (!existingUser) {
        // Create demo user
        const { error } = await supabase
          .from('profiles')
          .insert([{
            id: demoUserId,
            email: 'demo@discfinder.app',
            full_name: 'Demo User'
          }]);

        if (error) {
          console.warn('Could not create demo user:', error);
        }
      }
      return demoUserId;
    } catch (error) {
      console.warn('Demo user setup failed:', error);
      return demoUserId;
    }
  },

  // Create a new found disc report
  async createFoundDisc(discData: Omit<FoundDisc, 'id' | 'created_at' | 'updated_at' | 'status'>) {
    try {
      const { data, error } = await supabase
        .from('found_discs')
        .insert([{
          ...discData,
          status: 'active'
        }])
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Error creating found disc:', error)
      return { data: null, error }
    }
  },

  // Get a single found disc by ID
  async getFoundDiscById(discId: string) {
    try {
      // Try the public view first
      let { data, error } = await supabase
        .from('public_found_discs')
        .select('*')
        .eq('id', discId)
        .single();

      // If public view doesn't work, try main table
      if (error || !data) {
        const result = await supabase
          .from('found_discs')
          .select('*')
          .eq('id', discId)
          .eq('status', 'active')
          .single();

        data = result.data;
        error = result.error;
      }

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching found disc by ID:', error);
      return { data: null, error };
    }
  },

  // Get all FAQs
  async getFAQs() {
    try {
      const { data, error } = await supabase
        .from('t_faq')
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching FAQs:', error);
      return { data: null, error };
    }
  },

  // Get all active found discs with chunking to handle large datasets
  async getFoundDiscs(options: {
    limit?: number;
    offset?: number;
    fetchAll?: boolean;
    sortBy?: 'newest' | 'oldest' | 'rack_id_asc' | 'rack_id_desc';
    minRackId?: number;
    maxRackId?: number;
  } = {}) {
    try {
      const { limit = 1000, offset = 0, fetchAll = true, sortBy = 'newest', minRackId, maxRackId } = options;

      if (fetchAll) {
        // Fetch all records using chunking
        const result = await this.getAllFoundDiscsChunked();
        if (result.data) {
          // Apply client-side filtering and sorting
          let filteredData = result.data;

          // Apply rack ID filters
          if (minRackId !== undefined) {
            filteredData = filteredData.filter(disc => disc.rack_id && disc.rack_id >= minRackId);
          }
          if (maxRackId !== undefined) {
            filteredData = filteredData.filter(disc => disc.rack_id && disc.rack_id <= maxRackId);
          }

          // Apply sorting
          filteredData = this.sortFoundDiscs(filteredData, sortBy);

          return {
            ...result,
            data: filteredData,
            count: filteredData.length
          };
        }
        return result;
      } else {
        // Fetch specific page
        return await this.getFoundDiscsPage(limit, offset, sortBy, minRackId, maxRackId);
      }
    } catch (error) {
      console.error('Error fetching found discs:', error)
      return { data: null, error }
    }
  },

  // Helper method to sort found discs
  sortFoundDiscs(discs: FoundDisc[], sortBy: 'newest' | 'oldest' | 'rack_id_asc' | 'rack_id_desc'): FoundDisc[] {
    return [...discs].sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'rack_id_asc':
          return (a.rack_id || 0) - (b.rack_id || 0);
        case 'rack_id_desc':
          return (b.rack_id || 0) - (a.rack_id || 0);
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  },

  // Get a specific page of found discs
  async getFoundDiscsPage(limit: number = 50, offset: number = 0, sortBy: 'newest' | 'oldest' | 'rack_id_asc' | 'rack_id_desc' = 'newest', minRackId?: number, maxRackId?: number) {
    try {
      // Determine sort order
      let orderColumn = 'created_at';
      let ascending = false;

      switch (sortBy) {
        case 'oldest':
          orderColumn = 'created_at';
          ascending = true;
          break;
        case 'rack_id_asc':
          orderColumn = 'rack_id';
          ascending = true;
          break;
        case 'rack_id_desc':
          orderColumn = 'rack_id';
          ascending = false;
          break;
        case 'newest':
        default:
          orderColumn = 'created_at';
          ascending = false;
          break;
      }

      // Try the public view first (no status filter needed - view already filters for active discs)
      let query = supabase
        .from('public_found_discs')
        .select('*', { count: 'exact' });

      // Apply rack ID filters
      if (minRackId !== undefined) {
        query = query.gte('rack_id', minRackId);
      }
      if (maxRackId !== undefined) {
        query = query.lte('rack_id', maxRackId);
      }

      let { data, error, count } = await query
        .order(orderColumn, { ascending })
        .range(offset, offset + limit - 1);

      // If public view query fails, use main table with status filter
      if (error) {
        console.log('Public view failed, using main table instead:', error.message);
        let mainQuery = supabase
          .from('found_discs')
          .select('*', { count: 'exact' })
          .eq('status', 'active');

        // Apply rack ID filters
        if (minRackId !== undefined) {
          mainQuery = mainQuery.gte('rack_id', minRackId);
        }
        if (maxRackId !== undefined) {
          mainQuery = mainQuery.lte('rack_id', maxRackId);
        }

        const result = await mainQuery
          .order(orderColumn, { ascending })
          .range(offset, offset + limit - 1);

        data = result.data;
        error = result.error;
        count = result.count;
      }

      if (error) throw error
      return {
        data,
        error: null,
        count,
        hasMore: data && data.length === limit,
        nextOffset: offset + limit
      }
    } catch (error) {
      console.error('Error fetching found discs page:', error)
      return { data: null, error, count: 0, hasMore: false, nextOffset: 0 }
    }
  },

  // Get all found discs using chunked fetching to bypass 1000 record limit
  async getAllFoundDiscsChunked() {
    try {
      const allDiscs: FoundDisc[] = [];
      let offset = 0;
      const chunkSize = 1000;
      let hasMore = true;

      console.log('Fetching all found discs using chunked approach...');

      while (hasMore) {
        console.log(`Fetching chunk at offset ${offset}...`);

        // Try the public view first, fallback to main table
        let { data, error } = await supabase
          .from('public_found_discs')
          .select('*')
          .order('created_at', { ascending: false })
          .range(offset, offset + chunkSize - 1)

        // If public view doesn't exist or doesn't have image_urls, use main table
        if (error || (data && data.length > 0 && !data[0].hasOwnProperty('image_urls'))) {
          if (offset === 0) console.log('Using main table instead of view');
          const result = await supabase
            .from('found_discs')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .range(offset, offset + chunkSize - 1);

          data = result.data;
          error = result.error;
        }

        if (error) throw error;

        if (data && data.length > 0) {
          allDiscs.push(...data);
          console.log(`Fetched ${data.length} discs, total so far: ${allDiscs.length}`);

          // If we got fewer records than requested, we've reached the end
          hasMore = data.length === chunkSize;
          offset += chunkSize;
        } else {
          hasMore = false;
        }
      }

      console.log(`Completed chunked fetch: ${allDiscs.length} total discs`);
      return {
        data: allDiscs,
        error: null,
        count: allDiscs.length,
        hasMore: false,
        nextOffset: 0
      }
    } catch (error) {
      console.error('Error in chunked fetch:', error)
      return { data: null, error, count: 0, hasMore: false, nextOffset: 0 }
    }
  },

  // Search found discs by criteria with chunking support
  async searchFoundDiscs(searchCriteria: {
    brand?: string
    mold?: string
    color?: string
    discType?: string
    locationFound?: string
    rackId?: string
  }, options: {
    limit?: number;
    offset?: number;
    fetchAll?: boolean
  } = {}) {
    try {
      const { limit = 1000, offset = 0, fetchAll = true } = options;

      if (fetchAll) {
        // Fetch all matching records using chunking
        return await this.searchFoundDiscsChunked(searchCriteria);
      } else {
        // Fetch specific page
        return await this.searchFoundDiscsPage(searchCriteria, limit, offset);
      }
    } catch (error) {
      console.error('Error searching found discs:', error)
      return { data: null, error }
    }
  },

  // Search found discs with pagination
  async searchFoundDiscsPage(searchCriteria: {
    brand?: string
    mold?: string
    color?: string
    discType?: string
    locationFound?: string
    rackId?: string
  }, limit: number = 50, offset: number = 0) {
    try {
      // Try the public view first (no status filter needed - view already filters for active discs)
      let query = supabase
        .from('public_found_discs')
        .select('*', { count: 'exact' })

      if (searchCriteria.brand) {
        query = query.ilike('brand', `%${searchCriteria.brand}%`)
      }
      if (searchCriteria.mold) {
        query = query.ilike('mold', `%${searchCriteria.mold}%`)
      }
      if (searchCriteria.color) {
        query = query.ilike('color', `%${searchCriteria.color}%`)
      }
      if (searchCriteria.discType) {
        query = query.eq('disc_type', searchCriteria.discType)
      }
      if (searchCriteria.locationFound) {
        query = query.ilike('location_found', `%${searchCriteria.locationFound}%`)
      }
      if (searchCriteria.rackId) {
        const rackIdNum = parseInt(searchCriteria.rackId);
        if (!isNaN(rackIdNum)) {
          query = query.eq('rack_id', rackIdNum)
        }
      }

      let { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      // If public view query fails, use main table with status filter
      if (error) {
        console.log('Public view search failed, using main table instead:', error.message);
        let mainQuery = supabase
          .from('found_discs')
          .select('*', { count: 'exact' })
          .eq('status', 'active')

        if (searchCriteria.brand) {
          mainQuery = mainQuery.ilike('brand', `%${searchCriteria.brand}%`)
        }
        if (searchCriteria.mold) {
          mainQuery = mainQuery.ilike('mold', `%${searchCriteria.mold}%`)
        }
        if (searchCriteria.color) {
          mainQuery = mainQuery.ilike('color', `%${searchCriteria.color}%`)
        }
        if (searchCriteria.discType) {
          mainQuery = mainQuery.eq('disc_type', searchCriteria.discType)
        }
        if (searchCriteria.locationFound) {
          mainQuery = mainQuery.ilike('location_found', `%${searchCriteria.locationFound}%`)
        }
        if (searchCriteria.rackId) {
          const rackIdNum = parseInt(searchCriteria.rackId);
          if (!isNaN(rackIdNum)) {
            mainQuery = mainQuery.eq('rack_id', rackIdNum)
          }
        }

        const result = await mainQuery
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
        data = result.data;
        error = result.error;
        count = result.count;
      }

      if (error) throw error
      return {
        data,
        error: null,
        count,
        hasMore: data && data.length === limit,
        nextOffset: offset + limit
      }
    } catch (error) {
      console.error('Error searching found discs page:', error)
      return { data: null, error, count: 0, hasMore: false, nextOffset: 0 }
    }
  },

  // Search found discs using chunked fetching to get all results
  async searchFoundDiscsChunked(searchCriteria: {
    brand?: string
    mold?: string
    color?: string
    discType?: string
    locationFound?: string
    rackId?: string
  }) {
    try {
      const allDiscs: FoundDisc[] = [];
      let offset = 0;
      const chunkSize = 1000;
      let hasMore = true;

      console.log('Searching found discs using chunked approach...');

      while (hasMore) {
        console.log(`Searching chunk at offset ${offset}...`);

        const result = await this.searchFoundDiscsPage(searchCriteria, chunkSize, offset);

        if (result.error) throw result.error;

        if (result.data && result.data.length > 0) {
          allDiscs.push(...result.data);
          console.log(`Found ${result.data.length} discs, total so far: ${allDiscs.length}`);

          // If we got fewer records than requested, we've reached the end
          hasMore = result.data.length === chunkSize;
          offset += chunkSize;
        } else {
          hasMore = false;
        }
      }

      console.log(`Completed chunked search: ${allDiscs.length} total matching discs`);
      return {
        data: allDiscs,
        error: null,
        count: allDiscs.length,
        hasMore: false,
        nextOffset: 0
      }
    } catch (error) {
      console.error('Error in chunked search:', error)
      return { data: null, error, count: 0, hasMore: false, nextOffset: 0 }
    }
  },

  // Search found discs with a single query string across all fields
  async searchFoundDiscsWithQuery(searchQuery: string, options: {
    limit?: number;
    offset?: number;
    fetchAll?: boolean;
    sortBy?: 'newest' | 'oldest' | 'rack_id_asc' | 'rack_id_desc';
    minRackId?: number;
    maxRackId?: number;
  } = {}) {
    try {
      if (!searchQuery || searchQuery.trim() === '') {
        // If no search query, return all discs
        return this.getFoundDiscs(options);
      }

      const { limit = 1000, offset = 0, fetchAll = true, sortBy = 'newest', minRackId, maxRackId } = options;

      // For simple single-term searches, use server-side filtering for better performance
      const searchTerms = searchQuery.trim().toLowerCase().split(/\s+/);

      if (searchTerms.length === 1) {
        // Single term - use server-side search for better performance
        return await this.searchFoundDiscsSingleTerm(searchTerms[0], options);
      } else {
        // Multi-term search - still need client-side filtering for complex logic
        if (fetchAll) {
          const result = await this.searchFoundDiscsMultiTermChunked(searchTerms);
          if (result.data) {
            // Apply client-side filtering and sorting
            let filteredData = result.data;

            // Apply rack ID filters
            if (minRackId !== undefined) {
              filteredData = filteredData.filter(disc => disc.rack_id && disc.rack_id >= minRackId);
            }
            if (maxRackId !== undefined) {
              filteredData = filteredData.filter(disc => disc.rack_id && disc.rack_id <= maxRackId);
            }

            // Apply sorting
            filteredData = this.sortFoundDiscs(filteredData, sortBy);

            return {
              ...result,
              data: filteredData,
              count: filteredData.length
            };
          }
          return result;
        } else {
          return await this.searchFoundDiscsMultiTermPaginated(searchTerms, limit, offset, sortBy, minRackId, maxRackId);
        }
      }
    } catch (error) {
      console.error('Error searching found discs with query:', error);
      return { data: null, error };
    }
  },

  // Optimized single-term search using server-side filtering
  async searchFoundDiscsSingleTerm(term: string, options: {
    limit?: number;
    offset?: number;
    fetchAll?: boolean;
    sortBy?: 'newest' | 'oldest' | 'rack_id_asc' | 'rack_id_desc';
    minRackId?: number;
    maxRackId?: number;
  } = {}) {
    try {
      const { limit = 1000, offset = 0, fetchAll = true, sortBy = 'newest', minRackId, maxRackId } = options;

      if (fetchAll) {
        // Fetch all matching records using chunking
        const result = await this.searchFoundDiscsSingleTermChunked(term);
        if (result.data) {
          // Apply client-side filtering and sorting
          let filteredData = result.data;

          // Apply rack ID filters
          if (minRackId !== undefined) {
            filteredData = filteredData.filter(disc => disc.rack_id && disc.rack_id >= minRackId);
          }
          if (maxRackId !== undefined) {
            filteredData = filteredData.filter(disc => disc.rack_id && disc.rack_id <= maxRackId);
          }

          // Apply sorting
          filteredData = this.sortFoundDiscs(filteredData, sortBy);

          return {
            ...result,
            data: filteredData,
            count: filteredData.length
          };
        }
        return result;
      } else {
        // Fetch specific page
        return await this.searchFoundDiscsSingleTermPage(term, limit, offset, sortBy, minRackId, maxRackId);
      }
    } catch (error) {
      console.error('Error in single term search:', error);
      return { data: null, error };
    }
  },

  // Single-term search with pagination - optimized for rack_id searches
  async searchFoundDiscsSingleTermPage(term: string, limit: number, offset: number, sortBy: 'newest' | 'oldest' | 'rack_id_asc' | 'rack_id_desc' = 'newest', minRackId?: number, maxRackId?: number) {
    try {
      const lowerTerm = term.toLowerCase();
      const rackIdNum = parseInt(term);
      const isNumericSearch = !isNaN(rackIdNum);

      // If it's a numeric search (likely rack_id), try direct rack_id query first
      if (isNumericSearch) {
        console.log(`Searching for rack_id: ${rackIdNum}`);

        // Try direct rack_id search first
        let { data: rackIdResults, error: rackIdError } = await supabase
          .from('public_found_discs')
          .select('*')
          .eq('rack_id', rackIdNum);

        // If public view doesn't work, try main table
        if (rackIdError || !rackIdResults) {
          console.log('Trying main table for rack_id search');
          const result = await supabase
            .from('found_discs')
            .select('*')
            .eq('status', 'active')
            .eq('rack_id', rackIdNum);

          rackIdResults = result.data;
          rackIdError = result.error;
        }

        if (rackIdError) {
          console.error('Rack ID search error:', rackIdError);
        } else if (rackIdResults && rackIdResults.length > 0) {
          console.log(`Found ${rackIdResults.length} discs with rack_id ${rackIdNum}`);
          // For exact rack_id matches, return immediately
          return {
            data: rackIdResults,
            error: null,
            count: rackIdResults.length,
            hasMore: false,
            nextOffset: 0
          };
        }
      }

      // If no exact rack_id match or it's a text search, fall back to full search
      console.log(`Performing full search for term: "${term}"`);

      // Get all discs and filter client-side for comprehensive search
      const { data: allDiscs, error: fetchError } = await this.getAllFoundDiscsChunked();

      if (fetchError) {
        throw fetchError;
      }

      if (!allDiscs || allDiscs.length === 0) {
        return { data: [], error: null, count: 0, hasMore: false, nextOffset: 0 };
      }

      // Filter discs that match the search term
      const filteredDiscs = allDiscs.filter(disc => {
        const textFields = [
          disc.brand,
          disc.mold,
          disc.color,
          disc.location_found,
          disc.description,
          disc.stamp_text,
          disc.phone_number,
          disc.name_on_disc,
          disc.plastic_type,
          disc.disc_type
        ];

        const matchesText = textFields.some(field =>
          field && field.toLowerCase().includes(lowerTerm)
        );

        const matchesRackId = isNumericSearch && disc.rack_id === rackIdNum;

        return matchesText || matchesRackId;
      });

      console.log(`Full search found ${filteredDiscs.length} matching discs`);

      // Apply pagination to filtered results
      const paginatedResults = filteredDiscs.slice(offset, offset + limit);

      return {
        data: paginatedResults,
        error: null,
        count: filteredDiscs.length,
        hasMore: offset + limit < filteredDiscs.length,
        nextOffset: offset + limit
      };
    } catch (error) {
      console.error('Error in single term search page:', error);
      return { data: null, error, count: 0, hasMore: false, nextOffset: 0 };
    }
  },

  // Single-term search using chunked fetching - optimized for rack_id searches
  async searchFoundDiscsSingleTermChunked(term: string) {
    try {
      const lowerTerm = term.toLowerCase();
      const rackIdNum = parseInt(term);
      const isNumericSearch = !isNaN(rackIdNum);

      console.log(`Searching for single term "${term}" using chunked approach...`);

      // If it's a numeric search (likely rack_id), try direct rack_id query first
      if (isNumericSearch) {
        console.log(`Trying direct rack_id search for: ${rackIdNum}`);

        // Try direct rack_id search first
        let { data: rackIdResults, error: rackIdError } = await supabase
          .from('public_found_discs')
          .select('*')
          .eq('rack_id', rackIdNum);

        // If public view doesn't work, try main table
        if (rackIdError || !rackIdResults) {
          console.log('Trying main table for rack_id search');
          const result = await supabase
            .from('found_discs')
            .select('*')
            .eq('status', 'active')
            .eq('rack_id', rackIdNum);

          rackIdResults = result.data;
          rackIdError = result.error;
        }

        if (rackIdError) {
          console.error('Rack ID search error:', rackIdError);
        } else if (rackIdResults && rackIdResults.length > 0) {
          console.log(`Found ${rackIdResults.length} discs with rack_id ${rackIdNum}`);
          // For exact rack_id matches, return immediately
          return {
            data: rackIdResults,
            error: null,
            count: rackIdResults.length,
            hasMore: false,
            nextOffset: 0
          };
        }
      }

      // If no exact rack_id match or it's a text search, fall back to full search
      console.log(`Performing full chunked search for term: "${term}"`);

      // Get all discs first, then filter in JavaScript for reliable search
      const { data: allDiscs, error: fetchError } = await this.getAllFoundDiscsChunked();

      if (fetchError) {
        throw fetchError;
      }

      if (!allDiscs || allDiscs.length === 0) {
        return { data: [], error: null, count: 0, hasMore: false, nextOffset: 0 };
      }

      // Filter discs that match the search term
      const filteredDiscs = allDiscs.filter(disc => {
        const textFields = [
          disc.brand,
          disc.mold,
          disc.color,
          disc.location_found,
          disc.description,
          disc.stamp_text,
          disc.phone_number,
          disc.name_on_disc,
          disc.plastic_type,
          disc.disc_type
        ];

        const matchesText = textFields.some(field =>
          field && field.toLowerCase().includes(lowerTerm)
        );

        const matchesRackId = isNumericSearch && disc.rack_id === rackIdNum;

        return matchesText || matchesRackId;
      });

      console.log(`Completed single-term search: ${filteredDiscs.length} matching discs out of ${allDiscs.length} total`);
      return {
        data: filteredDiscs,
        error: null,
        count: filteredDiscs.length,
        hasMore: false,
        nextOffset: 0
      };
    } catch (error) {
      console.error('Error in chunked single-term search:', error);
      return { data: null, error, count: 0, hasMore: false, nextOffset: 0 };
    }
  },

  // Multi-term search with pagination (still needs client-side filtering)
  async searchFoundDiscsMultiTermPaginated(searchTerms: string[], limit: number, offset: number, sortBy: 'newest' | 'oldest' | 'rack_id_asc' | 'rack_id_desc' = 'newest', minRackId?: number, maxRackId?: number) {
    try {
      // For multi-term searches, we need to get a larger dataset and filter client-side
      // Get more records than requested to account for filtering
      const fetchLimit = Math.max(limit * 3, 1000); // Get 3x more records to account for filtering
      const { data: allDiscs, error: fetchError } = await this.getFoundDiscsPage(fetchLimit, 0, sortBy, minRackId, maxRackId);

      if (fetchError) {
        throw fetchError;
      }

      if (!allDiscs || allDiscs.length === 0) {
        return { data: [], error: null, count: 0, hasMore: false, nextOffset: 0 };
      }

      // Filter discs that match all search terms
      let filteredDiscs = allDiscs.filter(disc => {
        return searchTerms.every(term => {
          const lowerTerm = term.toLowerCase();

          const textFields = [
            disc.brand,
            disc.mold,
            disc.color,
            disc.location_found,
            disc.description,
            disc.stamp_text,
            disc.phone_number,
            disc.name_on_disc,
            disc.plastic_type,
            disc.disc_type
          ];

          const matchesText = textFields.some(field =>
            field && field.toLowerCase().includes(lowerTerm)
          );

          const rackIdNum = parseInt(term);
          const matchesRackId = !isNaN(rackIdNum) && disc.rack_id === rackIdNum;

          return matchesText || matchesRackId;
        });
      });

      // Apply rack ID filters
      if (minRackId !== undefined) {
        filteredDiscs = filteredDiscs.filter(disc => disc.rack_id && disc.rack_id >= minRackId);
      }
      if (maxRackId !== undefined) {
        filteredDiscs = filteredDiscs.filter(disc => disc.rack_id && disc.rack_id <= maxRackId);
      }

      // Apply sorting
      filteredDiscs = this.sortFoundDiscs(filteredDiscs, sortBy);

      // Apply pagination to filtered results
      const paginatedResults = filteredDiscs.slice(offset, offset + limit);

      return {
        data: paginatedResults,
        error: null,
        count: filteredDiscs.length,
        hasMore: offset + limit < filteredDiscs.length,
        nextOffset: offset + limit
      };
    } catch (error) {
      console.error('Error in multi-term paginated search:', error);
      return { data: null, error, count: 0, hasMore: false, nextOffset: 0 };
    }
  },

  // Multi-term search using chunked fetching
  async searchFoundDiscsMultiTermChunked(searchTerms: string[]) {
    try {
      console.log(`Searching for multi-term "${searchTerms.join(' ')}" using chunked approach...`);

      // Get all discs first, then filter in JavaScript for complex multi-term search
      const { data: allDiscs, error: fetchError } = await this.getAllFoundDiscsChunked();

      if (fetchError) {
        throw fetchError;
      }

      if (!allDiscs || allDiscs.length === 0) {
        return { data: [], error: null };
      }

      // Filter discs that match all search terms
      const filteredDiscs = allDiscs.filter(disc => {
        return searchTerms.every(term => {
          const lowerTerm = term.toLowerCase();

          const textFields = [
            disc.brand,
            disc.mold,
            disc.color,
            disc.location_found,
            disc.description,
            disc.stamp_text,
            disc.phone_number,
            disc.name_on_disc,
            disc.plastic_type,
            disc.disc_type
          ];

          const matchesText = textFields.some(field =>
            field && field.toLowerCase().includes(lowerTerm)
          );

          const rackIdNum = parseInt(term);
          const matchesRackId = !isNaN(rackIdNum) && disc.rack_id === rackIdNum;

          return matchesText || matchesRackId;
        });
      });

      console.log(`Completed multi-term search: ${filteredDiscs.length} matching discs out of ${allDiscs.length} total`);
      return {
        data: filteredDiscs,
        error: null,
        count: filteredDiscs.length,
        hasMore: false,
        nextOffset: 0
      };
    } catch (error) {
      console.error('Error in multi-term chunked search:', error);
      return { data: null, error, count: 0, hasMore: false, nextOffset: 0 };
    }
  },

  // Test connection to Supabase
  async testConnection() {
    try {
      const { error } = await supabase
        .from('found_discs')
        .select('count')
        .limit(1)

      return { connected: !error, error }
    } catch (error) {
      return { connected: false, error }
    }
  },

  // Update return status of a found disc (admin only)
  async updateReturnStatus(discId: string, returnStatus: ReturnStatus, notes?: string) {
    try {
      const { error } = await supabase.rpc('update_disc_return_status', {
        disc_id: discId,
        new_status: returnStatus,
        notes: notes || null
      });

      if (error) throw error;
      return { success: true, error: null };
    } catch (error) {
      console.error('Error updating return status:', error);
      return { success: false, error };
    }
  },



  // Get all found discs for admin (includes all return statuses)
  async getAdminFoundDiscs() {
    try {
      const { data, error } = await supabase
        .from('admin_found_discs')
        .select('*');

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching admin found discs:', error);
      return { data: null, error };
    }
  },

  // Bulk Turn-In Functions

  // Create a new bulk turn-in record (rakerdiver only)
  async createBulkTurnin(turninData: {
    location_collected: string;
    collection_date: string;
    collection_time?: string;
    disc_count: number;
    turnin_location: string;
    turnin_date: string;
    turnin_time?: string;
    notes?: string;
  }) {
    try {
      const { data, error } = await supabase.rpc('create_bulk_turnin', {
        p_location_collected: turninData.location_collected,
        p_collection_date: turninData.collection_date,
        p_disc_count: turninData.disc_count,
        p_turnin_location: turninData.turnin_location,
        p_turnin_date: turninData.turnin_date,
        p_collection_time: turninData.collection_time || null,
        p_turnin_time: turninData.turnin_time || null,
        p_notes: turninData.notes || null
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error creating bulk turn-in:', error);
      return { data: null, error };
    }
  },

  // Get bulk turn-ins for current rakerdiver
  async getRakerdiverTurnins() {
    try {
      const { data, error } = await supabase.rpc('get_rakerdiver_turnins');

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching rakerdiver turn-ins:', error);
      return { data: null, error };
    }
  },

  // Verify a bulk turn-in (admin only)
  async verifyBulkTurnin(turninId: string, verificationNotes?: string) {
    try {
      const { error } = await supabase.rpc('verify_bulk_turnin', {
        p_turnin_id: turninId,
        p_verification_notes: verificationNotes || null
      });

      if (error) throw error;
      return { success: true, error: null };
    } catch (error) {
      console.error('Error verifying bulk turn-in:', error);
      return { success: false, error };
    }
  },

  // Create a payment record (admin only)
  async createBulkTurninPayment(paymentData: {
    bulk_turnin_id: string;
    amount: number;
    payment_method?: string;
    payment_date?: string;
    payment_notes?: string;
  }) {
    try {
      const { data, error } = await supabase.rpc('create_bulk_turnin_payment', {
        p_bulk_turnin_id: paymentData.bulk_turnin_id,
        p_amount: paymentData.amount,
        p_payment_method: paymentData.payment_method || null,
        p_payment_date: paymentData.payment_date || null,
        p_payment_notes: paymentData.payment_notes || null
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error creating payment:', error);
      return { data: null, error };
    }
  },

  // Confirm payment receipt (rakerdiver only)
  async confirmPaymentReceipt(paymentId: string) {
    try {
      const { error } = await supabase.rpc('confirm_payment_receipt', {
        p_payment_id: paymentId
      });

      if (error) throw error;
      return { success: true, error: null };
    } catch (error) {
      console.error('Error confirming payment:', error);
      return { success: false, error };
    }
  },

  // Get all bulk turn-ins for admin
  async getAdminBulkTurnins() {
    try {
      const { data, error } = await supabase
        .from('admin_bulk_turnins')
        .select('*');

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching admin bulk turn-ins:', error);
      return { data: null, error };
    }
  },

  // Get payments for a specific bulk turn-in
  async getBulkTurninPayments(turninId: string) {
    try {
      const { data, error } = await supabase
        .from('bulk_turnin_payments')
        .select('*')
        .eq('bulk_turnin_id', turninId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching payments:', error);
      return { data: null, error };
    }
  }
}

// Image upload service
export const imageService = {
  // Upload multiple images to Supabase storage
  async uploadImages(files: File[], userId: string): Promise<{ urls: string[], error: any }> {
    try {
      console.log(`Starting upload of ${files.length} files for user ${userId}`);

      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      console.log('User authenticated:', user.id);

      const uploadPromises = files.map(async (file, index) => {
        // Generate unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}-${index}.${fileExt}`;

        console.log(`Uploading file ${index + 1}/${files.length}: ${fileName}`);

        const { data, error } = await supabase.storage
          .from('disc-images')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (error) {
          console.error(`Upload error for ${fileName}:`, error);
          throw error;
        }

        console.log(`Upload successful for ${fileName}:`, data);

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('disc-images')
          .getPublicUrl(fileName);

        console.log(`Public URL for ${fileName}:`, urlData.publicUrl);
        return urlData.publicUrl;
      });

      const urls = await Promise.all(uploadPromises);
      console.log('All uploads completed:', urls);
      return { urls, error: null };
    } catch (error) {
      console.error('Error uploading images:', error);
      return { urls: [], error };
    }
  },

  // Delete images from Supabase storage
  async deleteImages(imageUrls: string[]): Promise<{ success: boolean, error: any }> {
    try {
      // Extract file paths from URLs
      const filePaths = imageUrls.map(url => {
        const urlParts = url.split('/');
        const bucketIndex = urlParts.findIndex(part => part === 'disc-images');
        if (bucketIndex !== -1 && bucketIndex < urlParts.length - 1) {
          return urlParts.slice(bucketIndex + 1).join('/');
        }
        return null;
      }).filter(Boolean) as string[];

      if (filePaths.length === 0) {
        return { success: true, error: null };
      }

      const { error } = await supabase.storage
        .from('disc-images')
        .remove(filePaths);

      return { success: !error, error };
    } catch (error) {
      console.error('Error deleting images:', error);
      return { success: false, error };
    }
  },

  // Get optimized image URL (for future use with Supabase image transformations)
  getOptimizedImageUrl(originalUrl: string, width?: number, height?: number): string {
    // For now, return original URL
    // In the future, you can add Supabase image transformation parameters
    return originalUrl;
  },

  // Validate image file
  validateImageFile(file: File, maxSizeMB: number = 10): { valid: boolean, error?: string } {
    // Check file type
    if (!file.type.startsWith('image/')) {
      return { valid: false, error: 'File must be an image' };
    }

    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return { valid: false, error: `Image size must be less than ${maxSizeMB}MB` };
    }

    // Check supported formats
    const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!supportedTypes.includes(file.type)) {
      return { valid: false, error: 'Supported formats: JPEG, PNG, WebP' };
    }

    return { valid: true };
  }
}

// Export the service instance
export const supabaseService = {
  getSources: async (): Promise<Source[]> => {
    const { data, error } = await supabase
      .from('sources')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching sources:', error);
      throw error;
    }

    return data || [];
  },

  getActiveSources: async (): Promise<Source[]> => {
    const { data, error } = await supabase
      .from('sources')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching active sources:', error);
      throw error;
    }

    return data || [];
  },

  createSource: async (source: Omit<Source, 'id' | 'created_at' | 'updated_at'>): Promise<Source> => {
    const { data, error } = await supabase
      .from('sources')
      .insert([source])
      .select()
      .single();

    if (error) {
      console.error('Error creating source:', error);
      throw error;
    }

    return data;
  },

  updateSource: async (id: string, updates: Partial<Omit<Source, 'id' | 'created_at' | 'updated_at'>>): Promise<Source> => {
    const { data, error } = await supabase
      .from('sources')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating source:', error);
      throw error;
    }

    return data;
  },

  deleteSource: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('sources')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting source:', error);
      throw error;
    }
  },

  // Contact Attempts
  getContactAttempts: async (discId: string) => {
    try {
      const { data, error } = await supabase
        .from('contact_attempts')
        .select(`
          *,
          attempted_by_profile:profiles!attempted_by_profile_id(
            id,
            full_name,
            email
          )
        `)
        .eq('found_disc_id', discId)
        .order('attempted_at', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error fetching contact attempts:', error);
      return { success: false, error };
    }
  },

  addContactAttempt: async (contactAttempt: Omit<ContactAttempt, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('contact_attempts')
        .insert([contactAttempt])
        .select();

      if (error) throw error;
      return { success: true, data: data?.[0] };
    } catch (error) {
      console.error('Error adding contact attempt:', error);
      return { success: false, error };
    }
  },

  updateContactAttempt: async (id: string, updates: Partial<ContactAttempt>) => {
    try {
      const { data, error } = await supabase
        .from('contact_attempts')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select();

      if (error) throw error;
      return { success: true, data: data?.[0] };
    } catch (error) {
      console.error('Error updating contact attempt:', error);
      return { success: false, error };
    }
  },

  // Default Source Management
  getUserDefaultSource: async (userId: string): Promise<Source | null> => {
    try {
      // First get the user's default_source_id
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('default_source_id')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      // If no default source is set, return null
      if (!profileData?.default_source_id) {
        return null;
      }

      // Get the source details
      const { data: sourceData, error: sourceError } = await supabase
        .from('sources')
        .select('*')
        .eq('id', profileData.default_source_id)
        .eq('is_active', true)
        .single();

      if (sourceError) {
        // If source doesn't exist or is inactive, return null
        return null;
      }

      return sourceData as Source;
    } catch (error) {
      console.error('Error fetching user default source:', error);
      return null;
    }
  },

  updateUserDefaultSource: async (userId: string, sourceId: string | null): Promise<{ success: boolean; error?: any }> => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          default_source_id: sourceId,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error updating user default source:', error);
      return { success: false, error };
    }
  }
};
