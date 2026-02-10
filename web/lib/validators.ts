import { parsePhoneNumberFromString } from "libphonenumber-js";

export function validatePhoneNumber(number: string): {
  valid: boolean;
  error?: string;
} {
  const phone = parsePhoneNumberFromString(number);
  if (!phone || !phone.isValid()) {
    return { valid: false, error: "Invalid phone number" };
  }

  // Block premium/toll numbers
  const e164 = phone.format("E.164");
  if (e164.startsWith("+1900") || e164.startsWith("+1976")) {
    return { valid: false, error: "Premium numbers are not allowed" };
  }

  return { valid: true };
}

export function validateBriefing(text: string): {
  valid: boolean;
  error?: string;
} {
  const trimmed = text.trim();
  if (trimmed.length < 10) {
    return { valid: false, error: "Briefing must be at least 10 characters" };
  }
  if (trimmed.length > 2000) {
    return { valid: false, error: "Briefing must be under 2000 characters" };
  }
  return { valid: true };
}
