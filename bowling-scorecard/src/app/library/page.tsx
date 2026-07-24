import Link from 'next/link';

import { AppHeader } from '@/components/AppHeader';
import { auth } from '@/server/auth';
import { getTenantAccessForSession } from '@/server/auth/tenant';
import { StoredImagesLibrary } from '@/components/StoredImagesLibrary';

type LibraryPageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const session = await auth();
  const tenantAccess = session?.user ? await getTenantAccessForSession(session) : null;
  const e2eBypassEnabled =
    process.env.NODE_ENV !== 'production' && searchParams?.e2e === '1';
  const initialImageId =
    typeof searchParams?.imageId === 'string' && searchParams.imageId.trim() !== ''
      ? searchParams.imageId
      : null;
  const gameIndexParam = searchParams?.gameIndex;
  const parsedGameIndex =
    typeof gameIndexParam === 'string' ? Number.parseInt(gameIndexParam, 10) : null;
  const initialGameIndex =
    typeof parsedGameIndex === 'number' && Number.isFinite(parsedGameIndex)
      ? parsedGameIndex
      : null;
  const pageParam = searchParams?.page;
  const parsedPage = typeof pageParam === 'string' ? Number.parseInt(pageParam, 10) : 1;
  const initialPage =
    typeof parsedPage === 'number' && Number.isFinite(parsedPage) && parsedPage > 0
      ? parsedPage
      : 1;

  if (!session?.user && !e2eBypassEnabled) {
    return (
      <main className="auth-required">
        <div className="auth-card">
          <h1>Welcome to Bowling Scorecard Vibes</h1>
          <p>Sign in or create an account to save your scorecards and unlock personalized features.</p>
          <div className="auth-links">
            <Link href="/login">Log in</Link> · <Link href="/signup">Sign up</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <AppHeader
        userLabel={`Signed in as ${
          session?.user?.name ?? session?.user?.email ?? 'E2E Test User'
        }`}
        isAdmin={session?.user?.role === 'ADMIN'}
        canUpload={tenantAccess?.canEdit ?? false}
      />
      <div style={{ padding: '0 16px 16px', maxWidth: '1200px', margin: '0 auto' }}>
        <StoredImagesLibrary
          initialImageId={initialImageId}
          initialGameIndex={initialGameIndex}
          initialPage={initialPage}
        />
      </div>
    </main>
  );
}
