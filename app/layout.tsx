import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ClientRoot from '@/components/ClientRoot';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Sweepy - Material Recycling Tracker',
  description: 'Track and manage recyclable materials with ease',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta httpEquiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline'; img-src * data: blob:; font-src * data:; connect-src * wss: ws:; media-src * blob:;" />
      </head>
      <body className={inter.className}>
        <ClientRoot>{children}</ClientRoot>
      </body>
    </html>
  );
}