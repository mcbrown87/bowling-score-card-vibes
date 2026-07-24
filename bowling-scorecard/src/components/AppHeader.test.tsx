import { act, render, screen } from '@testing-library/react';

import { AppHeader } from './AppHeader';

jest.mock('next/navigation', () => ({
  usePathname: () => '/library'
}));

jest.mock('next-auth/react', () => ({
  signOut: jest.fn()
}));

describe('AppHeader', () => {
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: originalInnerWidth
    });
  });

  it('shows Upload navigation when upload access is allowed', () => {
    render(<AppHeader userLabel="Signed in as Owner" canUpload />);

    expect(screen.getByRole('link', { name: 'Upload' })).toHaveAttribute('href', '/');
  });

  it('hides Upload navigation for read-only tenant access', () => {
    render(<AppHeader userLabel="Signed in as Member" canUpload={false} />);

    expect(screen.queryByRole('link', { name: 'Upload' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Library' })).toBeVisible();
  });

  it('centers the mobile nav across visible read-only items', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 390
    });

    render(<AppHeader userLabel="Signed in as Member" canUpload={false} />);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    const nav = await screen.findByRole('navigation', { name: 'Primary navigation' });

    expect(nav.firstElementChild).toHaveStyle({
      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))'
    });
  });
});
