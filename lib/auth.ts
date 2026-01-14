import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { createClient } from '@supabase/supabase-js';

// Create Supabase client with service role for auth operations
const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
};

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Allow any @pmi.edu email
      if (!user.email || !user.email.endsWith('@pmi.edu')) {
        return false;
      }

      try {
        const supabase = getSupabaseAdmin();

        // Check if user exists in lab_users
        const { data: existingUser, error: fetchError } = await supabase
          .from('lab_users')
          .select('id, email, role')
          .ilike('email', user.email)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          // PGRST116 = no rows found, which is expected for new users
          console.error('Error checking for existing user:', fetchError);
          // Still allow sign in, user will be created on first API call
          return true;
        }

        // If user doesn't exist, create them
        if (!existingUser) {
          const { error: insertError } = await supabase
            .from('lab_users')
            .insert({
              email: user.email,
              name: user.name || user.email.split('@')[0],
              role: 'instructor', // Default role for new users
              is_active: true,
              approved_at: new Date().toISOString(), // Auto-approve PMI users
            });

          if (insertError) {
            console.error('Error creating lab_user:', insertError);
            // Still allow sign in - we can try again later
          } else {
            console.log(`Created new lab_user for ${user.email}`);
          }
        }

        return true;
      } catch (error) {
        console.error('Error in signIn callback:', error);
        // Allow sign in even if lab_users insert fails
        // The /api/instructor/me endpoint has fallback logic
        return true;
      }
    },
    async session({ session }) {
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
};