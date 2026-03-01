/**
 * System Configuration Utilities
 *
 * Provides server-side helpers for reading from the system_config table.
 * Use these in API routes only (they use the service-role client).
 */

import { getSupabaseAdmin } from './supabase';

export interface SystemConfigRow {
  id: string;
  config_key: string;
  config_value: unknown;
  category: string;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
}

/**
 * Fetch a single config value by key.
 * Returns the parsed JSONB value, or null if not found.
 */
export async function getConfig(key: string): Promise<unknown> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('system_config')
    .select('config_value')
    .eq('config_key', key)
    .single();

  if (error || !data) return null;
  return data.config_value;
}

/**
 * Fetch all configs in a given category.
 * Returns a map of config_key -> config_value.
 */
export async function getConfigsByCategory(
  category: string
): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('system_config')
    .select('config_key, config_value')
    .eq('category', category);

  if (error || !data) return {};

  const result: Record<string, unknown> = {};
  for (const row of data) {
    result[row.config_key] = row.config_value;
  }
  return result;
}

/**
 * Quick check whether a feature flag is enabled.
 * Looks up system_config.config_key where value is a boolean.
 * Returns false if the key doesn't exist or the value is not true.
 */
export async function isFeatureEnabled(featureKey: string): Promise<boolean> {
  const value = await getConfig(featureKey);
  return value === true;
}

/**
 * Fetch all rows from system_config (full rows with metadata).
 * Used by the admin config API.
 */
export async function getAllConfigs(): Promise<SystemConfigRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('system_config')
    .select('*')
    .order('category')
    .order('config_key');

  if (error || !data) return [];
  return data as SystemConfigRow[];
}

/**
 * Update a single config value.
 * Sets updated_by and updated_at on the row.
 */
export async function setConfig(
  key: string,
  value: unknown,
  updatedBy: string
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('system_config')
    .update({
      config_value: value,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    })
    .eq('config_key', key);

  return !error;
}
