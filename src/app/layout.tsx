import type { Metadata } from 'next';
import { Inter, Poppins, Quantico, Nunito, VT323, Noto_Sans, IBM_Plex_Sans, Source_Sans_3, Figtree, Atkinson_Hyperlegible } from 'next/font/google';
import './globals.css';
import { HomeAssistantProvider } from '@/hooks/useHomeAssistant';
import { FeatureFlagsProvider } from '@/hooks/useFeatureFlags';
import { HomeCenterPrefsProvider } from '@/hooks/useHomeCenterPrefs';
import { ThemeProvider } from '@/hooks/useTheme';
import { FontProvider } from '@/hooks/useFont';
import { ImmersiveModeProvider } from '@/hooks/useImmersiveMode';
import { PullToRevealProvider, SidebarItemsProvider, SidebarArrangeProvider, SearchProvider, AssistantProvider, HeaderProvider, AddContextProvider, ScreensaverProvider, EditModeProvider, ToastProvider, DebugFlagsProvider } from '@/contexts';
import { AppShell } from '@/components/layout';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
});

const quantico = Quantico({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-cyberpunk',
});

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-material',
});

const vt323 = VT323({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-fallout',
});

// ── Switchable prototype typefaces (all SIL OFL 1.1 — safe to ship in HA) ──
// Noto Sans: Google's "no-tofu" family, the widest language/character coverage.
const notoSans = Noto_Sans({
  subsets: ['latin', 'latin-ext', 'cyrillic', 'greek', 'vietnamese'],
  variable: '--font-noto',
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex',
});

const sourceSans = Source_Sans_3({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-source',
});

const figtree = Figtree({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-figtree',
});

const atkinson = Atkinson_Hyperlegible({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '700'],
  variable: '--font-atkinson',
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
    icon: [{ url: '/icon-512.png', type: 'image/png', sizes: '180x180' }],
    shortcut: '/icon-512.png',
    apple: [{ url: '/icon-512.png', type: 'image/png', sizes: '180x180' }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${poppins.variable} ${quantico.variable} ${nunito.variable} ${vt323.variable} ${notoSans.variable} ${ibmPlexSans.variable} ${sourceSans.variable} ${figtree.variable} ${atkinson.variable} antialiased`} suppressHydrationWarning>
        <ThemeProvider>
          <FontProvider>
          <FeatureFlagsProvider>
            <DebugFlagsProvider>
            <HomeCenterPrefsProvider>
            <HomeAssistantProvider>
              <ImmersiveModeProvider>
                <SidebarItemsProvider>
                  <SidebarArrangeProvider>
                  <PullToRevealProvider>
                    <SearchProvider>
                      <AssistantProvider>
                        <HeaderProvider>
                          <AddContextProvider>
                          <ScreensaverProvider>
                            <EditModeProvider>
                              <ToastProvider>
                                <AppShell>{children}</AppShell>
                              </ToastProvider>
                            </EditModeProvider>
                          </ScreensaverProvider>
                          </AddContextProvider>
                        </HeaderProvider>
                      </AssistantProvider>
                    </SearchProvider>
                  </PullToRevealProvider>
                  </SidebarArrangeProvider>
                </SidebarItemsProvider>
              </ImmersiveModeProvider>
            </HomeAssistantProvider>
            </HomeCenterPrefsProvider>
            </DebugFlagsProvider>
          </FeatureFlagsProvider>
          </FontProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
