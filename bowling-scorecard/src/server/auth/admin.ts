import { UserRole } from '@prisma/client';

import { auth } from '@/server/auth';

export async function requireAdmin() {
  const session = await auth();
  const isAdmin = session?.user?.role === UserRole.ADMIN;

  return {
    session,
    isAdmin
  };
}
