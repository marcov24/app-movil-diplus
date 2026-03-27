import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.miproyecto.dashboard',
  appName: 'Sistema de Monitoreo',
  webDir: 'dist',
  server: {
    androidScheme: 'http'
  }
};

export default config;
