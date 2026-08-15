const http = require('http');
const fs = require('fs');
const path = require('path');

// Local media server for playback testing, scoped to EXACTLY the four
// fixtures in test-media/FIXTURES.md (1 MP4 + 1 MKV from Movies, 2 MKVs from
// TV Shows — the TV Shows library has no MP4 files). Only these paths are
// reachable; anything else 404s, so no whole-library tree is ever exposed.
// Depends only on Node core modules. Supports HTTP Range (206) for seeking.
const FILES = {
    '/movies/gran-turismo-2023.mp4': 'E:\\Movies\\Gran Turismo (2023).mp4',
    '/movies/a-quiet-place-part-2.mkv': 'E:\\Movies\\A Quiet Place Part II (2020).mkv',
    '/tvshows/black-mirror-s01e02.mkv': 'E:\\TV Shows\\Black Mirror\\black.mirror.s01e02.720p.hdtv.x264-tla.300MB-BWBP.mkv',
    '/tvshows/dexter-original-sin-s01e01.mkv': 'E:\\TV Shows\\Dexter Original Sin\\Dexter.Original.Sin.S01E01.Dexter.Original.Sin.And.in.the.beginning.720p.AMZN.WEB-DL.DDP5.1.H.264-FLUX-BWBP.mkv',
};

const MIME = {
    '.mp4': 'video/mp4',
    '.mkv': 'video/x-matroska',
};

const PORT = 8081;

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const reqUrl = new URL(req.url, `http://${req.headers.host}`);

    if (reqUrl.pathname === '/fixtures') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(Object.keys(FILES)));
        return;
    }

    const filePath = FILES[reqUrl.pathname];
    if (!filePath || !fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not a whitelisted fixture');
        return;
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const contentType = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (start >= fileSize) {
            res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
            res.end();
            return;
        }

        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': end - start + 1,
            'Content-Type': contentType,
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
        });
        fs.createReadStream(filePath).pipe(res);
    }
});

server.listen(PORT, () => {
    console.log(`Local fixture media server running at http://localhost:${PORT}`);
    console.log('Whitelisted fixtures:');
    for (const url of Object.keys(FILES)) {
        console.log(`  ${url}`);
    }
});