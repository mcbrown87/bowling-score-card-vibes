import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bowling Scorecard Vibes',
  description: 'Upload a bowling scorecard image and auto-extract scores for every player.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
