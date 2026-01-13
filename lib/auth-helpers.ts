import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface LabUser {
  id: string;
  name: string;
  email: string;
  role: 'pending' | 'user' | 'instructor' | 'admin';
  is_active: boolean;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
}

/**
 * Find or create a user in lab_users table based on their OAuth session.
 * Called on login to ensure every authenticated user has a lab_users record.
 * New users start with role = 'pending'.
 */
export async function findOrCreateLabUser(
  email: string,
  name: string
): Promise<LabUser | null> {
  try {
    // Check if user exists (case-insensitive email match)
    const { data: existingUser, error: findError } = await supabase
      .from('lab_users')
      .select('*')
      .ilike('email', email)
      .single();

    if (existingUser && !findError) {
      return existingUser as LabUser;
    }

    // User doesn't exist, create with pending role
    const { data: newUser, error: createError } = await supabase
      .from('lab_users')
      .insert({
        name,
        email: email.toLowerCase(),
        role: 'pending',
        is_active: true
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating lab user:', createError);
      return null;
    }

    return newUser as LabUser;
  } catch (error) {
    console.error('Error in findOrCreateLabUser:', error);
    return null;
  }
}

/**
 * Get a user's role by email (case-insensitive)
 */
export async function getUserRole(email: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', email)
      .single();

    if (error || !data) return null;
    return data.role;
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
}

/**
 * Check if a user has admin privileges
 */
export async function isAdmin(email: string): Promise<boolean> {
  const role = await getUserRole(email);
  return role === 'admin';
}

/**
 * Check if a user has instructor privileges (instructor or admin)
 */
export async function isInstructor(email: string): Promise<boolean> {
  const role = await getUserRole(email);
  return role === 'instructor' || role === 'admin';
}

/**
 * Check if a user is approved (not pending)
 */
export async function isApproved(email: string): Promise<boolean> {
  const role = await getUserRole(email);
  return role !== null && role !== 'pending';
}
