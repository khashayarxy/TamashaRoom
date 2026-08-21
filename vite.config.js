import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    server: {
        host: '127.0.0.1',
        port: 5173,
        // Herd TLS runs on the site host; the browser lowercases URL hosts when
        // sending the Host header, but the laravel-vite-plugin derives the HMR
        // host from the (capitalized) project folder name. Vite's WebSocket
        // Host check is case-sensitive, so allow the lowercase form explicitly.
        allowedHosts: ['tamasharoom.test'],
    },
    plugins: [
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
