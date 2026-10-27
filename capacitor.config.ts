import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'wtf.shakespeare.marlowe',
  appName: 'Marlowe',
  webDir: 'dist',
  server: {
    // Handle deep links from your domain
    hostname: 'marlowe.shakespeare.wtf',
    androidScheme: 'https',
    iosScheme: 'https'
  },
  android: {
    // Enable safe area handling for notches and navigation bars
    allowMixedContent: false,
    backgroundColor: '#0a1a1a'
  },
  ios: {
    backgroundColor: '#0a1a1a',
    contentInset: 'automatic',
    scheme: 'Marlowe'
  }
};

export default config;
