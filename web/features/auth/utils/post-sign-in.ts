import { isBackOfficePath } from '@/shared/config/protected-routes';
import type { AuthContextResponse } from '../types/auth-context';

export const POST_SIGN_IN_PATH = '/auth/continue';

export function postSignInUrl(redirectUrl: unknown) {
  return typeof redirectUrl === 'string' && redirectUrl
    ? `${POST_SIGN_IN_PATH}?next=${encodeURIComponent(redirectUrl)}`
    : POST_SIGN_IN_PATH;
}

export function safeNextPath(value: string | null | undefined, origin: string) {
  if (!value) return '/';
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin || url.pathname.startsWith('//')) return '/';
    if (/^\/(sign-in|sign-up|auth\/continue)(\/|$)/.test(url.pathname)) return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}

export function isStaff(me: AuthContextResponse) {
  return me.memberships.some((membership) => membership.roles.length > 0);
}

export function resolvePostSignInPath(me: AuthContextResponse, next: string) {
  const nextIsBackOffice = isBackOfficePath(new URL(next, 'http://x').pathname);
  if (isStaff(me)) return nextIsBackOffice ? next : '/dashboard';
  return nextIsBackOffice ? '/' : next;
}
