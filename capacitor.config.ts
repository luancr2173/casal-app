import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.casalapp.app',
  appName: 'Casal App',
  webDir: 'dist/casal-app/browser',
  backgroundColor: '#0b1733',
  server: {
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#0b1733',
  },
};

export default config;
