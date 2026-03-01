import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// ---- Types ----

export interface SessionRecord {
  id: string;
  user_email: string;
  device_info: string | null;
  ip_address: string | null;
  location: string | null;
  user_agent: string | null;
  last_active: string;
  created_at: string;
  is_current: boolean;
  expires_at: string | null;
}

// ---- User-agent parser ----

export function parseUserAgent(ua: string): { browser: string; os: string } {
  if (!ua) return { browser: 'Unknown Browser', os: 'Unknown OS' };

  // Browser detection (order matters — more specific first)
  let browser = 'Unknown Browser';
  if (ua.includes('Edg/') || ua.includes('Edge/')) {
    browser = 'Edge';
  } else if (ua.includes('OPR/') || ua.includes('Opera/')) {
    browser = 'Opera';
  } else if (ua.includes('Chrome/') && !ua.includes('Chromium/')) {
    browser = 'Chrome';
  } else if (ua.includes('Chromium/')) {
    browser = 'Chromium';
  } else if (ua.includes('Firefox/')) {
    browser = 'Firefox';
  } else if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
    browser = 'Safari';
  } else if (ua.includes('MSIE') || ua.includes('Trident/')) {
    browser = 'Internet Explorer';
  }

  // OS detection
  let os = 'Unknown OS';
  if (ua.includes('Windows NT')) {
    const match = ua.match(/Windows NT ([\d.]+)/);
    const version = match ? match[1] : '';
    const versions: Record<string, string> = {
      '10.0': 'Windows 10/11',
      '6.3': 'Windows 8.1',
      '6.2': 'Windows 8',
      '6.1': 'Windows 7',
    };
    os = versions[version] ?? 'Windows';
  } else if (ua.includes('Mac OS X')) {
    os = 'macOS';
  } else if (ua.includes('iPhone')) {
    os = 'iOS (iPhone)';
  } else if (ua.includes('iPad')) {
    os = 'iOS (iPad)';
  } else if (ua.includes('Android')) {
    os = 'Android';
  } else if (ua.includes('Linux')) {
    os = 'Linux';
  } else if (ua.includes('CrOS')) {
    os = 'ChromeOS';
  }

  return { browser, os };
}

// ---- Device icon name resolver ----

export function getDeviceIcon(
  deviceInfo: string | null,
): 'Laptop' | 'Smartphone' | 'Tablet' | 'Monitor' {
  if (!deviceInfo) return 'Monitor';
  const lower = deviceInfo.toLowerCase();
  if (lower.includes('iphone') || lower.includes('android') || lower.includes('mobile')) {
    return 'Smartphone';
  }
  if (lower.includes('ipad') || lower.includes('tablet')) {
    return 'Tablet';
  }
  if (lower.includes('macos') || lower.includes('windows') || lower.includes('linux')) {
    return 'Laptop';
  }
  return 'Monitor';
}

// ---- Session tracker ----

export async function trackSession(
  email: string,
  request: NextRequest,
  sessionId?: string,
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();

    const ua = request.headers.get('user-agent') ?? '';
    const { browser, os } = parseUserAgent(ua);
    const deviceInfo = `${browser} on ${os}`;

    // Try to get real IP (handles proxies/Vercel)
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ipAddress =
      (forwardedFor ? forwardedFor.split(',')[0].trim() : null) ??
      realIp ??
      null;

    const now = new Date().toISOString();

    // If a sessionId is provided and it exists, update last_active and flip is_current
    if (sessionId) {
      const { data: existing } = await supabase
        .from('user_sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('user_email', email)
        .single();

      if (existing) {
        await supabase
          .from('user_sessions')
          .update({
            last_active: now,
            device_info: deviceInfo,
            user_agent: ua,
            is_current: true,
          })
          .eq('id', sessionId);

        // Unset is_current on all other sessions for this user
        await supabase
          .from('user_sessions')
          .update({ is_current: false })
          .eq('user_email', email)
          .neq('id', sessionId);

        return;
      }
    }

    // Insert new session record
    const { data: inserted } = await supabase
      .from('user_sessions')
      .insert({
        user_email: email,
        device_info: deviceInfo,
        ip_address: ipAddress,
        user_agent: ua,
        last_active: now,
        created_at: now,
        is_current: true,
      })
      .select('id')
      .single();

    if (!inserted) return;

    // Unset is_current on all other sessions for this user
    await supabase
      .from('user_sessions')
      .update({ is_current: false })
      .eq('user_email', email)
      .neq('id', inserted.id);
  } catch (err) {
    // Never throw — session tracking is best-effort
    console.error('trackSession error:', err);
  }
}
