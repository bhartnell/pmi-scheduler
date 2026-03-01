import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// ---- Types ----

export interface SessionRecord {
  id: string;
  user_email: string;
  device_info: { browser: string; os: string; device_type: string } | null;
  ip_address: string | null;
  last_active: string;
  created_at: string;
  session_token: string;
  is_revoked: boolean;
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

// ---- Device type detector ----

function getDeviceType(ua: string): string {
  if (ua.includes('iPhone') || (ua.includes('Android') && ua.includes('Mobile'))) {
    return 'mobile';
  }
  if (ua.includes('iPad') || ua.includes('Tablet')) {
    return 'tablet';
  }
  return 'desktop';
}

// ---- Device icon name resolver ----

export function getDeviceIcon(
  deviceInfo: { browser: string; os: string; device_type: string } | string | null,
): 'Laptop' | 'Smartphone' | 'Tablet' | 'Monitor' {
  if (!deviceInfo) return 'Monitor';

  // Handle both JSONB object (new schema) and legacy string format
  const deviceType = typeof deviceInfo === 'object' ? deviceInfo.device_type : null;
  const text = typeof deviceInfo === 'string' ? deviceInfo.toLowerCase() : JSON.stringify(deviceInfo).toLowerCase();

  if (deviceType === 'mobile' || text.includes('iphone') || text.includes('android') || text.includes('mobile')) {
    return 'Smartphone';
  }
  if (deviceType === 'tablet' || text.includes('ipad') || text.includes('tablet')) {
    return 'Tablet';
  }
  if (text.includes('macos') || text.includes('windows') || text.includes('linux')) {
    return 'Laptop';
  }
  return 'Monitor';
}

// ---- Session tracker ----

export async function trackSession(
  email: string,
  request: NextRequest,
  sessionToken?: string,
): Promise<string | null> {
  try {
    const supabase = getSupabaseAdmin();

    const ua = request.headers.get('user-agent') ?? '';
    const { browser, os } = parseUserAgent(ua);
    const deviceType = getDeviceType(ua);
    const deviceInfo = { browser, os, device_type: deviceType };

    // Try to get real IP (handles proxies/Vercel)
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ipAddress =
      (forwardedFor ? forwardedFor.split(',')[0].trim() : null) ??
      realIp ??
      null;

    const now = new Date().toISOString();

    // If a sessionToken is provided and it exists, update last_active
    if (sessionToken) {
      const { data: existing } = await supabase
        .from('user_sessions')
        .select('id')
        .eq('session_token', sessionToken)
        .eq('user_email', email)
        .eq('is_revoked', false)
        .single();

      if (existing) {
        await supabase
          .from('user_sessions')
          .update({
            last_active: now,
            device_info: deviceInfo,
          })
          .eq('session_token', sessionToken);

        return sessionToken;
      }
    }

    // Insert new session record with a unique token
    const newToken = crypto.randomUUID();

    const { data: inserted } = await supabase
      .from('user_sessions')
      .insert({
        user_email: email,
        device_info: deviceInfo,
        ip_address: ipAddress,
        last_active: now,
        created_at: now,
        session_token: newToken,
        is_revoked: false,
      })
      .select('session_token')
      .single();

    return inserted?.session_token ?? null;
  } catch (err) {
    // Never throw — session tracking is best-effort
    console.error('trackSession error:', err);
    return null;
  }
}
