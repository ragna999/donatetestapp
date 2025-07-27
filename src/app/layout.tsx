'use client';

import './globals.css';
import { ReactNode } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import Navbar from './components/navbar'; // atur path sesuai struktur folder lu
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-100 font-sans text-gray-900">
    <body className="bg-black text-white">
        <Navbar />
        {children}
      </body>
        <PrivyProvider
          appId="cmd8u9f7200fnju0mfqxq836a"
          config={{
            loginMethods: ['wallet'],
            appearance: { theme: 'light' },
          }}
        >
          <main className="min-h-screen">{children}</main>
        </PrivyProvider>
      </body>
    </html>
  );
}
