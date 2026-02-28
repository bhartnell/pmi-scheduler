// Shared form validation utilities

// ---- Named standalone exports (spec-compliant API) ----

export function validateEmail(email: string): string | null {
  if (!email?.trim()) return null; // not required by default; use validateRequired separately
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? null
    : 'Please enter a valid email address';
}

export function validatePhone(phone: string): string | null {
  if (!phone?.trim()) return null;
  return /^\+?[\d\s\-().]{7,15}$/.test(phone)
    ? null
    : 'Please enter a valid phone number';
}

export function validateRequired(value: string, fieldName: string): string | null {
  return !value?.trim() ? `${fieldName} is required` : null;
}

export function validateDateRange(start: string, end: string): string | null {
  return start && end && new Date(end) <= new Date(start)
    ? 'End date must be after start date'
    : null;
}

export function validateMinLength(value: string, min: number, fieldName: string): string | null {
  return value.trim().length < min
    ? `${fieldName} must be at least ${min} characters`
    : null;
}

export function validateMaxLength(value: string, max: number, fieldName: string): string | null {
  return value.trim().length > max
    ? `${fieldName} must be no more than ${max} characters`
    : null;
}

// ---- Validators object (internal convenience API used throughout the app) ----

// Individual validator functions — each returns an error string or null
export const validators = {
  required: (value: string, fieldName?: string): string | null =>
    !value?.trim() ? `${fieldName || 'This field'} is required` : null,

  email: (value: string): string | null =>
    value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      ? 'Please enter a valid email address'
      : null,

  phone: (value: string): string | null =>
    value && !/^\+?[\d\s\-().]{7,15}$/.test(value)
      ? 'Please enter a valid phone number'
      : null,

  minLength: (value: string, min: number): string | null =>
    value.length < min ? `Must be at least ${min} characters` : null,

  maxLength: (value: string, max: number): string | null =>
    value.length > max ? `Must be no more than ${max} characters` : null,

  dateRange: (start: string, end: string): string | null =>
    start && end && new Date(end) <= new Date(start)
      ? 'End date must be after start date'
      : null,

  futureDate: (value: string): string | null =>
    value && new Date(value) < new Date()
      ? 'Date must be in the future'
      : null,

  number: (value: string): string | null =>
    value && isNaN(Number(value)) ? 'Must be a valid number' : null,

  positiveNumber: (value: string): string | null =>
    value && (isNaN(Number(value)) || Number(value) <= 0)
      ? 'Must be a positive number'
      : null,

  timeRange: (start: string, end: string): string | null =>
    start && end && end <= start
      ? 'End time must be after start time'
      : null,
};

// Validate a form object against a rules map.
// rules: { fieldKey: [validatorFn, ...] }
// Returns a Record<string, string> of field -> first error message found (or empty object if valid)
export function validateForm(
  data: Record<string, unknown>,
  rules: Record<string, Array<(value: unknown) => string | null>>
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of Object.keys(rules)) {
    const value = data[field];
    for (const rule of rules[field]) {
      const error = rule(value);
      if (error) {
        errors[field] = error;
        break; // Only report first error per field
      }
    }
  }

  return errors;
}

// Returns true if errors object has no entries
export function isFormValid(errors: Record<string, string>): boolean {
  return Object.keys(errors).length === 0;
}
