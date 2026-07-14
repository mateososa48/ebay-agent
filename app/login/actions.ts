'use server';

import { cookies } from 'next/headers';

export async function loginAction(
  password: string,
): Promise<{ ok: boolean; reason?: 'wrong' | 'misconfigured' }> {
  const expected = process.env.EVE_APP_PASSWORD;
  const token = process.env.EVE_APP_TOKEN;
  // Match middleware's predicate exactly: the gate is ON iff EVE_APP_TOKEN is set.
  // No token → gate disabled (local dev), let anyone in.
  if (!token) return { ok: true };
  // Token set but no password would make the cookie unsettable → middleware would loop
  // the user back to /login forever with no error. Surface it instead of silently looping.
  if (!expected) return { ok: false, reason: 'misconfigured' };
  if (password !== expected) return { ok: false, reason: 'wrong' };
  (await cookies()).set('desk_auth', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 60, // 60 days
  });
  return { ok: true };
}
