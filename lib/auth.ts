import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import { getSupabaseAdmin } from '@/lib/supabase';
import { notifyAdminsNewPendingUser, insertDefaultNotificationPreferences } from '@/lib/notifications';

// PMI-internal domains (Google OAuth)
const PMI_DOMAINS = ['pmi.edu', 'my.pmi.edu'];

function isPMIDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return PMI_DOMAINS.some(d => domain === d || domain?.endsWith(`.${d}`));
}

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
    // Microsoft Azure AD for external agency partners and contracted students
    ...(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET
      ? [
          AzureADProvider({
            clientId: process.env.AZURE_AD_CLIENT_ID,
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
            tenantId: 'common', // allows any Microsoft org
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Persist the OAuth access_token and refresh_token to the token right after signin
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : 0;
        token.provider = account.provider; // 'google' or 'azure-ad'
      }
      return token;
    },
    async signIn({ user, account }) {
      if (!user.email) {
        return false;
      }

      const email = user.email.toLowerCase();
      const provider = account?.provider || 'google';

      // Allow @pmi.edu (instructors) and @my.pmi.edu (students) emails
      const isInstructorEmail = email.endsWith('@pmi.edu') && !email.endsWith('@my.pmi.edu');
      const isStudentEmail = email.endsWith('@my.pmi.edu');

      try {
        const supabase = getSupabaseAdmin();

        // Check if user exists in lab_users
        const { data: existingUser, error: fetchError } = await supabase
          .from('lab_users')
          .select('id, email, role')
          .ilike('email', email)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          // PGRST116 = no rows found, which is expected for new users
          console.error('Error checking for existing user:', fetchError);
          return true;
        }

        // If user already exists in DB with an approved (non-pending) role, allow sign in
        if (existingUser && existingUser.role !== 'pending') {
          return true;
        }

        // --- External user flow (non-PMI domain) ---
        if (!isPMIDomain(email)) {
          // Check the approved external emails whitelist
          const { data: approved } = await supabase
            .from('approved_external_emails')
            .select('*')
            .eq('email', email)
            .eq('is_active', true)
            .single();

          if (!approved && !existingUser) {
            // Not on whitelist and no existing account — reject with clear error
            return '/auth/error?error=AccessRestricted';
          }

          // If not approved but has an existing pending account, let them through
          // (they were previously allowed via request-access flow)
          if (!approved && existingUser) {
            return true;
          }

          // Approved external user — create lab_users record on first login
          if (approved && !existingUser) {
            const authProvider = provider === 'azure-ad' ? 'microsoft' : provider;

            if (approved.default_role === 'student') {
              // Auto-provision student with student role
              const { data: newUser, error: insertError } = await supabase
                .from('lab_users')
                .insert({
                  email,
                  name: user.name || email.split('@')[0],
                  role: 'student',
                  auth_provider: authProvider,
                  agency_affiliation: approved.organization,
                  agency_scope: approved.default_scope || [],
                  is_active: true,
                  approved_at: new Date().toISOString(),
                })
                .select('id, name, email, role')
                .single();

              if (insertError) {
                console.error('Error creating external student lab_user:', insertError);
              } else if (newUser) {
                insertDefaultNotificationPreferences(newUser.email, newUser.role)
                  .catch(err => console.error('Failed to insert default notification prefs:', err));
              }
            } else {
              // Agency staff — create with their default role (or pending if not set)
              const role = approved.default_role || 'pending';
              const { data: newUser, error: insertError } = await supabase
                .from('lab_users')
                .insert({
                  email,
                  name: user.name || email.split('@')[0],
                  role,
                  auth_provider: authProvider,
                  agency_affiliation: approved.organization,
                  agency_scope: approved.default_scope || [],
                  is_active: true,
                  approved_at: role !== 'pending' ? new Date().toISOString() : null,
                })
                .select('id, name, email, role')
                .single();

              if (insertError) {
                console.error('Error creating external agency lab_user:', insertError);
              } else if (newUser) {
                insertDefaultNotificationPreferences(newUser.email, newUser.role)
                  .catch(err => console.error('Failed to insert default notification prefs:', err));

                if (role === 'pending') {
                  notifyAdminsNewPendingUser({
                    userId: newUser.id,
                    name: newUser.name,
                    email: newUser.email,
                  }).catch(err => console.error('Failed to notify admins of new user:', err));
                }
              }
            }
          }

          return true;
        }

        // --- PMI domain flow (existing logic) ---

        // For non-PMI users with no existing account (should not reach here due to domain check above,
        // but keep as safety net for edge cases like pmi.edu subdomains)
        if (!isInstructorEmail && !isStudentEmail) {
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
              email,
              name: user.name || email.split('@')[0],
              role: newRole,
              is_active: true,
              auth_provider: 'google',
              approved_at: isStudent ? new Date().toISOString() : null,
            })
            .select('id, name, email, role')
            .single();

          if (insertError) {
            console.error('Error creating lab_user:', insertError);
          } else if (newUser) {
            insertDefaultNotificationPreferences(newUser.email, newUser.role)
              .catch(err => console.error('Failed to insert default notification prefs:', err));

            if (!isStudent) {
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
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours (default for all roles; agency 4hr timeout is client-side)
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
};
