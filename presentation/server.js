'use strict';
/**
 * Athar backend — Node stdlib only (http, fs, path, url).
 * Serves static files from presentation/ and a minimal JSON API backed by
 * AtharEngine (presentation/athar-engine.js — the single source of truth
 * for all math, shared with the browser UI and the test suite).
 *
 * Run: node presentation/server.js
 * Listens on http://localhost:8734
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');

const AtharEngine = require('./athar-engine.js');

const PORT = 8734;
const ROOT_DIR = path.resolve(__dirname);
const WORKS_GEOJSON_PATH = path.join(ROOT_DIR, 'data', 'works.geojson');
const MAX_BODY_BYTES = 1024 * 1024; // 1MB JSON body size limit

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendPlainError(res, statusCode, message) {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message);
}

/**
 * Read and JSON-parse a request body with a hard size limit.
 * Rejects with an Error on overflow or invalid JSON.
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let totalBytes = 0;
    const chunks = [];

    req.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw.trim() === '') {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('Invalid JSON body'));
      }
    });

    req.on('error', (err) => reject(err));
  });
}

async function handleApiScore(req, res) {
  try {
    const body = await readJsonBody(req);
    const result = AtharEngine.score(body);
    sendJson(res, 200, result);
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
}

async function handleApiOptimize(req, res) {
  try {
    const body = await readJsonBody(req);
    const result = AtharEngine.optimize(body);
    sendJson(res, 200, result);
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
}

async function handleApiDigOnce(req, res) {
  try {
    const body = await readJsonBody(req);
    const result = AtharEngine.digOnce(body);
    sendJson(res, 200, result);
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
}

function handleApiWorks(req, res) {
  fs.readFile(WORKS_GEOJSON_PATH, 'utf8', (err, data) => {
    if (err) {
      sendJson(res, 404, { error: 'works.geojson not found' });
      return;
    }
    res.writeHead(200, { 'Content-Type': CONTENT_TYPES['.geojson'] });
    res.end(data);
  });
}

/**
 * Serve a static file from ROOT_DIR, guarding against path traversal.
 */
function serveStatic(req, res, pathname) {
  const decodedPath = decodeURIComponent(pathname);
  const relativePath = decodedPath === '/' ? '/athar-prototype.html' : decodedPath;

  const requestedPath = path.resolve(path.join(ROOT_DIR, relativePath));

  // Path-traversal guard: resolved path must stay within ROOT_DIR.
  if (!requestedPath.startsWith(ROOT_DIR + path.sep) && requestedPath !== ROOT_DIR) {
    sendPlainError(res, 403, 'Forbidden');
    return;
  }

  fs.stat(requestedPath, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      sendPlainError(res, 404, 'Not Found');
      return;
    }

    fs.readFile(requestedPath, (readErr, data) => {
      if (readErr) {
        sendPlainError(res, 500, 'Internal Server Error');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentTypeFor(requestedPath) });
      res.end(data);
    });
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url);
  const pathname = parsedUrl.pathname || '/';

  if (pathname === '/api/score' && req.method === 'POST') {
    handleApiScore(req, res);
    return;
  }
  if (pathname === '/api/optimize' && req.method === 'POST') {
    handleApiOptimize(req, res);
    return;
  }
  if (pathname === '/api/digonce' && req.method === 'POST') {
    handleApiDigOnce(req, res);
    return;
  }
  if (pathname === '/api/works' && req.method === 'GET') {
    handleApiWorks(req, res);
    return;
  }
  if (pathname.startsWith('/api/')) {
    sendJson(res, 404, { error: 'Unknown API route' });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendPlainError(res, 405, 'Method Not Allowed');
    return;
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`أثر backend يعمل على http://localhost:${PORT}`);
});

module.exports = server;
