// Список самых популярных disposable-доменов.
// Можно расширять или заменить на allowlist (разрешённые домены).
export function isDisposableEmail(email) {
    try {
      const domain = email.split('@')[1]?.toLowerCase().trim();
      if (!domain) return true;
      const bad = new Set([
        'mailinator.com','guerrillamail.com','10minutemail.com','tempmail.io','tempmail.com',
        'yopmail.com','trashmail.com','getnada.com','sharklasers.com','dispostable.com',
        'moakt.com','temp-mail.org','emailondeck.com','linshi-email.com','throwawaymail.com',
        'maildrop.cc','mintemail.com','fakemail.net','trash-mail.com','mytemp.email'
      ]);
      return bad.has(domain);
    } catch {
      return true;
    }
  }
  