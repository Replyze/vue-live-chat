/**
 * What identity verification signs, exactly as the Replyze server picks it:
 * the user id as a string without surrounding spaces when there is one,
 * otherwise the email trimmed and in lower case. Null when there is neither.
 */
export function identitySubject(user: { user_id?: string | number | null; email?: string | null }): string | null {
  const userId = user.user_id === undefined || user.user_id === null ? '' : String(user.user_id).trim();
  if (userId !== '') return userId;
  const email = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
  return email !== '' ? email : null;
}
