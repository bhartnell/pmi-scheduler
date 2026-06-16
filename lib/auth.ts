import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import { getSupabaseAdmin } from '@/lib/supabase';
import { notifyAdminsNewPendingUser, notifyAdminsUnmatchedStudentSignup, insertDefaultNotificationPreferences } from '@/lib/notifications';

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

        // If user doesn't exist, create them.
        //
        // FIRST-PROVISION ONLY: this block runs solely when there is no
        // lab_users row yet. Subsequent logins short-circuit above, so an
        // already-assigned role is NEVER auto-changed (e.g. a my.pmi.edu
        // instructor candidate manually set to volunteer_instructor stays put).
        //
        // Role-default rule (decision A1 + B1):
        //   - @my.pmi.edu (student domain) -> ALWAYS default to the restricted
        //     `student` role (safe to auto-grant; one-directional). We also try
        //     a roster-enrollment match (same students.email match the exam
        //     signup gate uses). On a match we set primary_cohort_id (B1); on
        //     NO match we still grant student (A1 floor) but notify admins to
        //     review/assign the right cohort.
        //   - @pmi.edu (instructors) -> `pending`, admin notified. NEVER
        //     auto-elevated to any staff/faculty role.
        if (!existingUser) {
          const isStudent = isStudentEmail;
          const newRole = isStudent ? 'student' : 'pending';

          // Roster-enrollment match (students.email, case-insensitive) — mirrors
          // getRosterStudent() in lib/exam-scheduling.ts. Kept inline so the auth
          // module doesn't take on the exam module's dependencies.
          let rosterCohortId: string | null = null;
          let rosterMatched = false;
          if (isStudent) {
            const { data: rosterRow } = await supabase
              .from('students')
              .select('cohort_id')
              .ilike('email', email)
              .limit(1)
              .maybeSingle();
            if (rosterRow) {
              rosterMatched = true;
              rosterCohortId = rosterRow.cohort_id ?? null;
            }
          }

          const insertRow: Record<string, unknown> = {
            email,
            name: user.name || email.split('@')[0],
            role: newRole,
            is_active: true,
            auth_provider: 'google',
            approved_at: isStudent ? new Date().toISOString() : null,
          };
          if (isStudent && rosterCohortId) {
            insertRow.primary_cohort_id = rosterCohortId; // B1
          }

          const { data: newUser, error: insertError } = await supabase
            .from('lab_users')
            .insert(insertRow)
            .select('id, name, email, role')
            .single();

          if (insertError) {
            console.error('Error creating lab_user:', insertError);
          } else if (newUser) {
            insertDefaultNotificationPreferences(newUser.email, newUser.role)
              .catch(err => console.error('Failed to insert default notification prefs:', err));

            if (!isStudent) {
              // @pmi.edu instructor — pending, needs admin role assignment.
              notifyAdminsNewPendingUser({
                userId: newUser.id,
                name: newUser.name,
                email: newUser.email,
              }).catch(err => console.error('Failed to notify admins of new user:', err));
            } else if (!rosterMatched) {
              // A1: student-domain login with no roster match — granted student
              // (floor) but flagged for admin review.
              notifyAdminsUnmatchedStudentSignup({
                userId: newUser.id,
                name: newUser.name,
                email: newUser.email,
              }).catch(err => console.error('Failed to notify admins of unmatched student:', err));
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
    // 30 days. Was 24h, which forced a Google re-login for anyone
    // away longer than a day. The agency 4h inactivity timeout is
    // still enforced client-side (SessionTimeoutWatcher) and is
    // unaffected by this — it's an inactivity cap, not a session
    // lifetime.
    maxAge: 30 * 24 * 60 * 60, // 30 days = 2592000s
  },
  jwt: {
    // Keep the JWT lifetime in lockstep with the session. When this
    // is unset NextAuth defaults it to session.maxAge anyway, but
    // setting it explicitly prevents the two drifting apart if
    // someone edits one and forgets the other.
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  // No explicit `cookies` block: NextAuth already derives the
  // session-token cookie's maxAge from session.maxAge above, so the
  // cookie is a persistent 30-day cookie with the correct
  // environment-aware name (__Secure- prefix in production) and
  // security flags. Overriding cookies.sessionToken would mean
  // hand-replicating all of that, which is error-prone for no gain.
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
};
