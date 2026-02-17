import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { createClient } from '@supabase/supabase-js';
import { notifyAdminsNewPendingUser } from '@/lib/notifications';

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
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/gmail.send',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Persist the OAuth access_token and refresh_token to the token right after signin
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : 0;
      }
      return token;
    },
    async signIn({ user }) {
      // Allow @pmi.edu (instructors) and @my.pmi.edu (students) emails
      const isInstructorEmail = user.email?.endsWith('@pmi.edu') && !user.email?.endsWith('@my.pmi.edu');
      const isStudentEmail = user.email?.endsWith('@my.pmi.edu');

      if (!user.email || (!isInstructorEmail && !isStudentEmail)) {
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
          // Students (@my.pmi.edu) get auto-approved with 'student' role
          // Instructors (@pmi.edu) get 'pending' role and require admin approval
          const isStudent = isStudentEmail;
          const newRole = isStudent ? 'student' : 'pending';

          const { data: newUser, error: insertError } = await supabase
            .from('lab_users')
            .insert({
              email: user.email,
              name: user.name || user.email.split('@')[0],
              role: newRole,
              is_active: true,
              // Students are auto-approved, instructors need admin approval
              approved_at: isStudent ? new Date().toISOString() : null,
            })
            .select('id, name, email, role')
            .single();

          if (insertError) {
            console.error('Error creating lab_user:', insertError);
            // Still allow sign in - we can try again later
          } else {
            console.log(`Created new lab_user for ${user.email} with ${newRole} role`);
            // Only notify admins about new pending instructor users (not students)
            if (newUser && !isStudent) {
              notifyAdminsNewPendingUser({
                userId: newUser.id,
                name: newUser.name,
                email: newUser.email,
              }).catch(err => console.error('Failed to notify admins of new user:', err));
            }
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
    async session({ session, token }) {
      // Send properties to the client
      session.accessToken = token.accessToken as string | undefined;
      session.refreshToken = token.refreshToken as string | undefined;
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
};