'use client';

import './globals.css';
import { PrivyProvider } from '@privy-io/react-auth';
import { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PrivyProvider
          appId="cmd8u9f7200fnju0mfqxq836a" // GANTI DENGAN PUNYA LO
          config={{
            loginMethods: ['wallet'],
            appearance: {
              theme: 'light',
            },
          }}
        >
          {children}
        </PrivyProvider>
      </body>
    </html>
  );
}
