/**
 * TOTP (Time-based One-Time Password) implementation using Node.js crypto only.
 * RFC 6238 compliant: HMAC-SHA1, 30-second time steps, 6-digit codes.
 */

import * as crypto from 'crypto';

// ---- Base32 helpers ----

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encode a Buffer as a base32 string (RFC 4648).
 */
function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31];
  }

  // Pad to multiple of 8
  while (output.length % 8 !== 0) {
    output += '=';
  }

  return output;
}

/**
 * Decode a base32 string to a Buffer (RFC 4648).
 * Ignores padding characters and is case-insensitive.
 */
function base32Decode(str: string): Buffer {
  const upper = str.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of upper) {
    const idx = BASE32_CHARS.indexOf(char);
    if (idx < 0) continue; // skip invalid chars
    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

// ---- Secret generation ----

/**
 * Generate a random TOTP secret (20 bytes, base32 encoded).
 * Returns a base32 string suitable for use in authenticator apps.
 */
export function generateTOTPSecret(): string {
  const bytes = crypto.randomBytes(20);
  return base32Encode(bytes);
}

// ---- TOTP code generation ----

/**
 * Generate a TOTP code for the given secret and time counter.
 * Uses HMAC-SHA1, produces a 6-digit decimal code.
 */
function generateTOTPCode(secret: string, counter: number): string {
  const key = base32Decode(secret);

  // Pack counter as a big-endian 8-byte buffer
  const counterBuf = Buffer.alloc(8);
  // JavaScript's bitwise operators truncate to 32 bits, so handle the
  // high 32 bits manually for counters that exceed 2^32.
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  counterBuf.writeUInt32BE(high, 0);
  counterBuf.writeUInt32BE(low, 4);

  const hmac = crypto.createHmac('sha1', key);
  hmac.update(counterBuf);
  const digest = hmac.digest();

  // Dynamic truncation
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset]     & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8)  |
    ( digest[offset + 3] & 0xff);

  const otp = code % 1_000_000;
  return otp.toString().padStart(6, '0');
}

/**
 * Get the current TOTP time counter (30-second steps since Unix epoch).
 */
function getCurrentCounter(timestampMs?: number): number {
  const ts = timestampMs ?? Date.now();
  return Math.floor(ts / 30_000);
}

/**
 * Verify a TOTP code against a secret, allowing ±1 time window for clock drift.
 * Returns true if the code is valid.
 */
export function verifyTOTP(secret: string, code: string, timestampMs?: number): boolean {
  const trimmedCode = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(trimmedCode)) return false;

  const counter = getCurrentCounter(timestampMs);

  // Check current window and one window before/after
  for (let delta = -1; delta <= 1; delta++) {
    const expected = generateTOTPCode(secret, counter + delta);
    if (crypto.timingSafeEqual(
      Buffer.from(trimmedCode),
      Buffer.from(expected),
    )) {
      return true;
    }
  }

  return false;
}

/**
 * Generate the current TOTP code (for testing / display purposes).
 */
export function getCurrentTOTPCode(secret: string): string {
  return generateTOTPCode(secret, getCurrentCounter());
}

// ---- Backup codes ----

const BACKUP_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Generate an array of 10 random 8-character alphanumeric backup codes.
 */
export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    let code = '';
    const bytes = crypto.randomBytes(8);
    for (let j = 0; j < bytes.length; j++) {
      code += BACKUP_CODE_CHARS[bytes[j] % BACKUP_CODE_CHARS.length];
    }
    // Format as XXXX-XXXX for readability
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}

/**
 * Verify a backup code against the stored list of unused backup codes.
 * Returns the updated list with the used code removed (if matched), or null if invalid.
 */
export function verifyAndConsumeBackupCode(
  storedCodes: string[],
  inputCode: string,
): { valid: boolean; remainingCodes: string[] } {
  const normalised = inputCode.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const idx = storedCodes.findIndex((c) => c.toUpperCase() === normalised);
  if (idx === -1) {
    return { valid: false, remainingCodes: storedCodes };
  }
  const remainingCodes = [...storedCodes.slice(0, idx), ...storedCodes.slice(idx + 1)];
  return { valid: true, remainingCodes };
}

// ---- OTPAuth URI ----

/**
 * Build an otpauth:// URI for use in authenticator app QR codes.
 */
export function buildOTPAuthURI(email: string, secret: string): string {
  const issuer = 'PMI EMS';
  const label = encodeURIComponent(`${issuer}:${email}`);
  const encodedIssuer = encodeURIComponent(issuer);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}
