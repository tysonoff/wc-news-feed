import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sasknewsfeed.app',
  appName: 'Sask News Feed',
  webDir: 'www',
  server: {
    // Points the app at your real, already-live website instead of
    // bundling a separate local copy — the app is a thin native shell
    // around the actual working site.
    url: 'https://www.sasknewsfeed.com',
    cleartext: false,
  },
};

export default config;