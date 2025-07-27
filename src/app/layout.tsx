'use client';

import './globals.css';
import { ReactNode } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import Navbar from './components/navbar';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-100 font-sans text-gray-900">
        <PrivyProvider
          appId="cmd8u9f7200fnju0mfqxq836a"
          config={{
            loginMethods: ['wallet'],
            appearance: { theme: 'light' },
          }}
        >
        <Navbar/>
          <main className="min-h-screen">{children}</main>
        </PrivyProvider>
      </body>
    </html>
  );
}
