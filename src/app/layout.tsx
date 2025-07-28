'use client';

import './globals.css';
import { ReactNode, useEffect } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import Navbar from './components/navbar';

export default function RootLayout({ children }: { children: ReactNode }) {
  // ✅ Perbaikan error postMessage Privy yang bukan JSON
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data === 'string' && event.data.includes('onboardingcomplete')) {
        // ❌ Privy kadang kirim string biasa, bukan JSON
        console.warn('📭 Ignored non-JSON message from Privy:', event.data);
        return;
      }

      // 👇 Kalau perlu tangani pesan JSON valid
      try {
        JSON.parse(event.data);
      } catch (_) {}
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <html lang="en">
      <body className="bg-gray-100 font-sans text-gray-900">
        <PrivyProvider
          appId="cmd8u9f7200fnju0mfqxq836a"
          config={{
            loginMethods: ['wallet', 'email', 'twitter'],
            appearance: { theme: 'light' },
          }}
        >
          <Navbar />
          <main className="min-h-screen">{children}</main>
        </PrivyProvider>
      </body>
    </html>
  );
}
