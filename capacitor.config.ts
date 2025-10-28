import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sweepy.app',
  appName: 'Sweepy',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  }
};

export default config;
