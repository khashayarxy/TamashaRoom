import fs from 'fs';
import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Sail-local HTTPS: mkcert certs at ./docker/ssl/ (host & container via bind mount).
// When certs exist (local Sail), Vite serves HMR over wss://tamasharoom.test:5173.
// In CI (no certs), fallback to plain http/ws on localhost.
const certPath = './docker/ssl/tamasharoom.test.pem';
const keyPath = './docker/ssl/tamasharoom.test-key.pem';
const hasCerts = fs.existsSync(certPath) && fs.existsSync(keyPath);

export default defineConfig({
    server: {
        host: '0.0.0.0',
        port: 5173,
        https: hasCerts
            ? {
                  cert: fs.readFileSync(certPath),
                  key: fs.readFileSync(keyPath),
              }
            : undefined,
        hmr: hasCerts
            ? {
                  host: 'tamasharoom.test',
                  protocol: 'wss',
                  port: 5173,
                  clientPort: 5173,
              }
            : {
                  host: 'localhost',
              },
        // Herd TLS runs on the site host; the browser lowercases URL hosts when
        // sending the Host header, but the laravel-vite-plugin derives the HMR
        // host from the (capitalized) project folder name. Vite's WebSocket
        // Host check is case-sensitive, so allow the lowercase form explicitly.
        allowedHosts: ['tamasharoom.test', 'localhost'],
    },
    plugins: [
        {
            name: 'ignore-unused-videojs-locales',
            enforce: 'pre',
            resolveId(source) {
                // Video.js ships ~76 locale files; TamashaRoom only needs fa (+ en fallback).
                // Eagerly preloading all 76 via Vite's modulepreload bursts the
                // shared-hosting LVE Entry-Process limit (see TASK.md). Stub the rest.
                if (
                    source.includes(
                        '@videojs/core/dist/default/i18n/locales/',
                    ) &&
                    !source.includes('/fa') &&
                    !source.includes('/en')
                ) {
                    return '\0empty-locale';
                }
                // Also handle Vite-resolved absolute paths for the same files
                // (e.g. node_modules/@videojs/core/dist/default/i18n/locales/ar.js)
                if (
                    /\/locales\/(ar|az|bg|bn|bs|ca|cs|cy|da|de|el|es|et|eu|fi|fr|gd|gl|he|hi|hr|hu|it|ja|ko|lv|mr|nb|ne|nl|nn|oc|pl|pt|ro|ru|sk|sl|sr|sv|te|th|tr|uk|vi|zh)/.test(
                        source,
                    ) &&
                    !source.includes('/fa') &&
                    !source.includes('/en')
                ) {
                    return '\0empty-locale';
                }
                return null;
            },
            load(id) {
                if (id === '\0empty-locale') {
                    return 'export default {};';
                }
                return null;
            },
        },
        laravel({
            input: [
                'resources/css/app.css',
                'resources/js/app.tsx',
                'resources/fonts/Vazirmatn-Medium.woff2',
            ],
            refresh: true,
        }),
        react({
            babel: {
                plugins: [['babel-plugin-react-compiler', {}]],
            },
        }),
        tailwindcss(),
    ],
    resolve: {
        alias: {
            '@': '/resources/js',
        },
    },
});
