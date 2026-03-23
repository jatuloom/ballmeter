import { defineConfig } from 'vite';
import fs from 'fs';

const isLocal = fs.existsSync('./certs/key.pem');

export default defineConfig({
  root: '.',
  publicDir: 'public',
  base: '/ballmeter/',
  build: {
    outDir: 'dist',
  },
  server: isLocal
    ? {
        host: true,
        https: {
          key: fs.readFileSync('./certs/key.pem'),
          cert: fs.readFileSync('./certs/cert.pem'),
        },
      }
    : { host: true },
});
