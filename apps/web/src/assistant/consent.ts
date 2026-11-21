/**
 * Whether the person has said yes to the assistant (PRD §15.2.2, §17.1). This is the ONLY thing the app
 * ever writes to the device, and it is just the name of the assistant they agreed to. Saying no stores
 * nothing, so they are asked again next time they open it. Browsers can refuse storage (private windows,
 * blocked site data), so every use is wrapped: if it fails, the answer is simply "not yet".
 */
const KEY = "cleartax.assistant";

export function hasConsent(providerId: string): boolean {
  try {
    return window.localStorage.getItem(KEY) === providerId;
  } catch {
    return false;
  }
}

export function grantConsent(providerId: string): void {
  try {
    window.localStorage.setItem(KEY, providerId);
  } catch {
    // Not remembered; they will be asked again. Nothing else changes.
  }
}

export function revokeConsent(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to remove.
  }
}
