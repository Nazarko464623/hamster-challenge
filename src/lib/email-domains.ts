// Email domains suggested after the user types "@" in the email field.
// Ordered by how likely a player is to use them: Ukrainian services first, then the
// big international providers, then popular European ones.
// Russian (and Belarusian state-linked) mail services are intentionally left out.
export const EMAIL_DOMAINS = [
  'gmail.com',
  'ukr.net',
  'i.ua',
  'meta.ua',
  'lpnu.ua',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'me.com',
  'yahoo.com',
  'proton.me',
  'protonmail.com',
  'tuta.com',
  'gmx.com',
  'gmx.net',
  'gmx.de',
  'web.de',
  'aol.com',
  'zoho.com',
  'mail.com',
  'wp.pl',
  'onet.pl',
  'o2.pl',
  'interia.pl',
  'seznam.cz',
];

// Domains that are never suggested, even if added to the list above by mistake.
const BLOCKED_DOMAINS = new Set([
  'mail.ru',
  'bk.ru',
  'list.ru',
  'inbox.ru',
  'internet.ru',
  'yandex.ru',
  'yandex.com',
  'yandex.ua',
  'ya.ru',
  'rambler.ru',
  'lenta.ru',
  'autorambler.ru',
  'ro.ru',
  'vk.com',
  'tut.by',
]);

const BLOCKED_ZONES = ['.ru', '.su', '.by', '.рф'];

export function isBlockedEmailDomain(domain: string) {
  const value = domain.trim().toLowerCase();
  return BLOCKED_DOMAINS.has(value) || BLOCKED_ZONES.some((zone) => value.endsWith(zone));
}

// Characters allowed in an email address: Latin letters, digits and a few symbols.
// Cyrillic and other alphabets are not accepted: mail services give out Latin-only addresses.
const EMAIL_ALLOWED_CHARS = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~@-]*$/;
const EMAIL_FORMAT = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

/** True when the text has letters or symbols that cannot be in an email (e.g. Cyrillic). */
export function hasInvalidEmailChars(value: string) {
  return !EMAIL_ALLOWED_CHARS.test(value.trim());
}

/** Full check of an email address (Latin only, local part, @, domain with a zone). */
export function isValidEmail(value: string) {
  return EMAIL_FORMAT.test(value.trim());
}

/**
 * Returns full email addresses to suggest for what the user has typed so far.
 * Suggestions appear only after "@" and only while the domain is not complete yet.
 * Example: "ivan@g" -> ["ivan@gmail.com", "ivan@gmx.com", ...]
 */
export function getEmailSuggestions(value: string, limit = 4): string[] {
  const atIndex = value.indexOf('@');
  if (atIndex < 1 || value.indexOf('@', atIndex + 1) !== -1 || /\s/.test(value)) {
    return [];
  }

  if (hasInvalidEmailChars(value)) {
    return [];
  }

  const localPart = value.slice(0, atIndex);
  const typedDomain = value.slice(atIndex + 1).toLowerCase();

  if (EMAIL_DOMAINS.includes(typedDomain)) {
    return [];
  }

  return EMAIL_DOMAINS.filter(
    (domain) => domain.startsWith(typedDomain) && !isBlockedEmailDomain(domain)
  )
    .slice(0, limit)
    .map((domain) => `${localPart}@${domain}`);
}
