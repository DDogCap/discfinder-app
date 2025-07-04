import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile } from '../lib/supabase';

export type UserRole = 'guest' | 'user' | 'admin' | 'rakerdiver';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  userRole: UserRole;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  isGuest: boolean;
  isUser: boolean;
  isAdmin: boolean;
  isRakerDiver: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('guest');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session with timeout
    const initAuth = async () => {
      try {
        console.log('Initializing auth...');
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.warn('Auth session error:', error);
          setUserRole('guest');
          setLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          console.log('User found, fetching profile...');
          await fetchProfile(session.user.id);
        } else {
          console.log('No user session, setting as guest');
          setUserRole('guest');
          setLoading(false);
        }
      } catch (error) {
        console.warn('Auth initialization failed:', error);
        setUserRole('guest');
        setLoading(false);
      }
    };

    // Set a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.warn('Auth initialization timeout, setting as guest');
      setUserRole('guest');
      setLoading(false);
    }, 5000); // 5 second timeout

    initAuth().finally(() => {
      clearTimeout(timeoutId);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setUserRole('guest');
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      console.log('Fetching profile for user:', userId);

      // Add timeout for profile fetch
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout')), 3000)
      );

      const { data, error } = await Promise.race([profilePromise, timeoutPromise]) as any;

      if (error) {
        console.warn('Profile fetch error:', error);

        // If profile doesn't exist, check for imported profile or create new one
        if (error.code === 'PGRST116') {
          console.log('Profile not found, checking for imported profile...');
          try {
            const { data: userData } = await supabase.auth.getUser();
            if (userData.user) {
              // First, check if there's an imported profile in staging with this email
              const { data: importedProfile, error: importError } = await supabase
                .from('imported_profiles_staging')
                .select('*')
                .eq('email', userData.user.email!)
                .single();

              if (importedProfile && !importError) {
                console.log('Found imported profile, creating linked profile...');
                // Create profile using imported data
                const newProfile = {
                  id: userData.user.id,
                  email: userData.user.email!,
                  full_name: userData.user.user_metadata?.full_name || importedProfile.full_name,
                  role: importedProfile.role as UserRole,
                  legacy_row_id: importedProfile.legacy_row_id,
                  pdga_number: importedProfile.pdga_number,
                  facebook_profile: importedProfile.facebook_profile,
                  instagram_handle: importedProfile.instagram_handle,
                  sms_number: importedProfile.sms_number,
                  phone_number: importedProfile.phone_number,
                  avatar_url: importedProfile.avatar_url,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                };

                const { data: createdProfile, error: createError } = await supabase
                  .from('profiles')
                  .insert([newProfile])
                  .select()
                  .single();

                if (createError) {
                  console.error('Error creating linked profile:', createError);
                } else {
                  console.log('Successfully created linked profile');

                  // Remove from staging since it's now linked
                  await supabase
                    .from('imported_profiles_staging')
                    .delete()
                    .eq('id', importedProfile.id);

                  setProfile(createdProfile);
                  setUserRole(createdProfile.role as UserRole || 'user');
                  setLoading(false);
                  return;
                }
              }

              // No imported profile found, create a new one
              console.log('No imported profile found, creating new profile...');
              const newProfile = {
                id: userData.user.id,
                email: userData.user.email!,
                full_name: userData.user.user_metadata?.full_name || '',
                role: userData.user.email === 'galen.adams@dropzonepaintball.com' ? 'admin' as UserRole : 'user' as UserRole,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };

              const { data: createdProfile, error: createError } = await supabase
                .from('profiles')
                .insert([newProfile])
                .select()
                .single();

              if (createError) {
                console.error('Error creating new profile:', createError);
              } else {
                console.log('Profile created successfully');
                setProfile(createdProfile);
                setUserRole(createdProfile.role as UserRole || 'user');
                setLoading(false);
                return;
              }
            }
          } catch (createError) {
            console.warn('Failed to create profile:', createError);
          }
        }

        // If we can't fetch/create profile, continue as authenticated user without profile
        console.log('Continuing without profile data');
        setUserRole('user');
        setLoading(false);
        return;
      }

      console.log('Profile fetched successfully:', data);
      setProfile(data);
      setUserRole(data.role || 'user');
      setLoading(false);
    } catch (error) {
      console.error('Error in fetchProfile:', error);
      // Don't fail completely, just continue as authenticated user
      setUserRole('user');
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      // If user creation succeeded, check for imported profile or create new one
      if (data.user && !error) {
        try {
          // Look for an existing imported profile in staging with this email
          const { data: importedProfile, error: importError } = await supabase
            .from('imported_profiles_staging')
            .select('*')
            .eq('email', data.user.email!)
            .single();

          if (importedProfile && !importError) {
            console.log('Found imported profile during signup, creating linked profile...');
            // Create profile using imported data
            await supabase
              .from('profiles')
              .insert([{
                id: data.user.id,
                email: data.user.email!,
                full_name: fullName || importedProfile.full_name,
                role: importedProfile.role,
                legacy_row_id: importedProfile.legacy_row_id,
                pdga_number: importedProfile.pdga_number,
                facebook_profile: importedProfile.facebook_profile,
                instagram_handle: importedProfile.instagram_handle,
                sms_number: importedProfile.sms_number,
                phone_number: importedProfile.phone_number,
                avatar_url: importedProfile.avatar_url,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }]);

            // Remove from staging since it's now linked
            await supabase
              .from('imported_profiles_staging')
              .delete()
              .eq('id', importedProfile.id);

            console.log('Successfully linked imported profile during signup');
          } else {
            // No imported profile, create new one
            await supabase
              .from('profiles')
              .insert([{
                id: data.user.id,
                email: data.user.email!,
                full_name: fullName,
                role: data.user.email === 'galen.adams@dropzonepaintball.com' ? 'admin' : 'user',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }]);
          }
        } catch (profileError) {
          console.warn('Profile creation/linking failed, but user was created:', profileError);
          // Don't fail the signup if profile creation fails
        }
      }

      return { data, error };
    } catch (error) {
      return { data: null, error: { message: 'Supabase not configured. This is a demo.' } };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      return { data, error };
    } catch (error) {
      return { data: null, error: { message: 'Supabase not configured. This is a demo.' } };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
      }
    } catch (error) {
      console.log('Supabase not configured, running in demo mode');
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      // Refresh profile
      await fetchProfile(user.id);
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  const value = {
    user,
    profile,
    session,
    userRole,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    isGuest: userRole === 'guest',
    isUser: userRole === 'user',
    isAdmin: userRole === 'admin',
    isRakerDiver: userRole === 'rakerdiver',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
