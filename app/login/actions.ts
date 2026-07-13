'use server';

import { cookies } from 'next/headers';

export async function loginAction(password: string): Promise<{ ok: boolean }> {
  const expected = process.env.EVE_APP_PASSWORD;
  const token = process.env.EVE_APP_TOKEN;
  if (!expected || !token) return { ok: true }; // auth not configured — let dev in
  if (password !== expected) return { ok: false };
  (await cookies()).set('desk_auth', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 60, // 60 days
  });
  return { ok: true };
}
