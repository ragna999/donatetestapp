'use client';

import './globals.css';
import { ReactNode, useEffect } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { sepolia } from 'viem/chains';
import Navbar from './components/navbar';
import Footer from './components/footer';

export default function RootLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data === 'string' && event.data.includes('onboardingcomplete')) return;
      try { JSON.parse(event.data); } catch (_) {}
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <html lang="id">
      <body className="bg-[#060d1a] font-sans text-gray-900 antialiased">
        <PrivyProvider
          appId="cmd8u9f7200fnju0mfqxq836a"
          config={{
            loginMethods: ['wallet', 'email', 'twitter'],
            appearance: { theme: 'dark' },
            embeddedWallets: { createOnLogin: 'users-without-wallets' },
            defaultChain: sepolia,
            supportedChains: [sepolia],
          }}
        >
          <Navbar />
          <main className="min-h-screen pt-16">{children}</main>
          <Footer />
        </PrivyProvider>
      </body>
    </html>
  );
}
