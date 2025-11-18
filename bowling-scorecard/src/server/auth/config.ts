import { PrismaAdapter } from '@auth/prisma-adapter';
import type { Adapter } from 'next-auth/adapters';
import type { NextAuthOptions } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { compare } from 'bcryptjs';
import { z } from 'zod';

import { prisma } from '../db/client';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const authConfig: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  session: {
    strategy: 'jwt'
  },
  jwt: {
    maxAge: 60 * 60 * 24 * 30 // 30 days
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        const email = (profile as { email?: string })?.email ?? user.email;
        const emailVerified =
          (profile as { email_verified?: boolean | string | undefined })?.email_verified;

        // Require a verified Google email
        if (!email || emailVerified === false) {
          return false;
        }

        const existingUser = await prisma.user.findUnique({
          where: { email }
        });

        if (existingUser) {
          await prisma.account.upsert({
            where: {
              provider_providerAccountId: {
                provider: account.provider,
                providerAccountId: account.providerAccountId
              }
            },
            create: {
              userId: existingUser.id,
              type: account.type,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              accessToken: account.access_token,
              refreshToken: account.refresh_token,
              expiresAt:
                account.expires_at !== null && account.expires_at !== undefined
                  ? Number(account.expires_at)
                  : null,
              tokenType: account.token_type ?? null,
              scope: account.scope ?? null,
              idToken: account.id_token ?? null,
              sessionState: account.session_state ?? null
            },
            update: {
              accessToken: account.access_token,
              refreshToken: account.refresh_token,
              expiresAt:
                account.expires_at !== null && account.expires_at !== undefined
                  ? Number(account.expires_at)
                  : null,
              tokenType: account.token_type ?? null,
              scope: account.scope ?? null,
              idToken: account.id_token ?? null,
              sessionState: account.session_state ?? null
            }
          });
        }
      }
      return true;
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? ''
    }),
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      authorize: async (rawCredentials) => {
        const credentials = await credentialsSchema.safeParseAsync(rawCredentials);
        if (!credentials.success) {
          return null;
        }
        const user = await prisma.user.findUnique({
          where: { email: credentials.data.email }
        });

        if (!user?.passwordHash) {
          return null;
        }

        const isValidPassword = await compare(credentials.data.password, user.passwordHash);

        if (!isValidPassword) {
          return null;
        }

        return user;
      }
    })
  ],
  pages: {
    signIn: '/login'
  }
};
