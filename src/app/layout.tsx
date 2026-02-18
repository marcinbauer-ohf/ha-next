import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { HomeAssistantProvider } from '@/hooks/useHomeAssistant';
import { ThemeProvider } from '@/hooks/useTheme';
import { ImmersiveModeProvider } from '@/hooks/useImmersiveMode';
import { PullToRevealProvider, SidebarItemsProvider, SearchProvider, AssistantProvider, HeaderProvider, ScreensaverProvider } from '@/contexts';
import { AppShell } from '@/components/layout';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Home Assistant Dashboard',
  description: 'Smart home control dashboard',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'HA Dashboard',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`} suppressHydrationWarning>
        <ThemeProvider>
          <HomeAssistantProvider>
            <ImmersiveModeProvider>
              <SidebarItemsProvider>
                <PullToRevealProvider>
                  <SearchProvider>
                    <AssistantProvider>
                      <HeaderProvider>
                        <ScreensaverProvider>
                          <AppShell>{children}</AppShell>
                        </ScreensaverProvider>
                      </HeaderProvider>
                    </AssistantProvider>
                  </SearchProvider>
                </PullToRevealProvider>
              </SidebarItemsProvider>
            </ImmersiveModeProvider>
          </HomeAssistantProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
