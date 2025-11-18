import NextAuth, { getServerSession, type NextAuthOptions } from 'next-auth';

import { authConfig } from './config';

export const authOptions: NextAuthOptions = authConfig;

const handler = NextAuth(authOptions);

export const handlers = { GET: handler, POST: handler };

export function auth() {
  return getServerSession(authOptions);
}
