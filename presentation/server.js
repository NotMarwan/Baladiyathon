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
class RequestBodyError extends Error {
  constructor(statusCode, code) {
    super(code);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let totalBytes = 0;
    let chunks = [];
    let tooLarge = false;

    req.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        tooLarge = true;
        chunks = [];
        return;
      }
      if (!tooLarge) chunks.push(chunk);
    });

    req.on('end', () => {
      if (tooLarge) {
        reject(new RequestBodyError(413, 'PAYLOAD_TOO_LARGE'));
        return;
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw.trim() === '') {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new RequestBodyError(400, 'INVALID_JSON'));
      }
    });

    req.on('error', (err) => reject(err));
  });
}

function isPlainObject(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value);
}

function validateScoreInput(input) {
  const fields = {};
  const required = ['aadt', 'lanes', 'lanesClosed', 'startHour', 'durationHours'];

  required.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(input, field)
        || input[field] === undefined) {
      fields[field] = 'required';
    }
  });

  function requireFinite(field) {
    if (Object.prototype.hasOwnProperty.call(fields, field)) return false;
    if (typeof input[field] !== 'number' || !Number.isFinite(input[field])) {
      fields[field] = 'must be a finite number';
      return false;
    }
    return true;
  }

  if (requireFinite('aadt') && input.aadt <= 0) {
    fields.aadt = 'must be greater than 0';
  }
  if (requireFinite('lanes')) {
    if (!Number.isInteger(input.lanes) || input.lanes <= 0) {
      fields.lanes = 'must be a positive integer';
    }
  }
  if (requireFinite('lanesClosed')) {
    if (!Number.isInteger(input.lanesClosed)
        || !Number.isInteger(input.lanes)
        || input.lanesClosed < 1
        || input.lanesClosed > input.lanes) {
      fields.lanesClosed = 'must be between 1 and lanes';
    }
  }
  if (requireFinite('startHour')) {
    if (!Number.isInteger(input.startHour)
        || input.startHour < 0
        || input.startHour > 23) {
      fields.startHour = 'must be an integer between 0 and 23';
    }
  }
  if (requireFinite('durationHours') && input.durationHours <= 0) {
    fields.durationHours = 'must be greater than 0';
  }

  ['capacityPerLane', 'freeFlowMin'].forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(input, field)) return;
    if (typeof input[field] !== 'number' || !Number.isFinite(input[field])) {
      fields[field] = 'must be a finite number';
    } else if (input[field] <= 0) {
      fields[field] = 'must be greater than 0';
    }
  });

  return { valid: Object.keys(fields).length === 0, fields };
}

function validateDigOnceInput(input) {
  const fields = {};
  for (const field of ['trenchKm', 'permitsMerged']) {
    if (!Object.prototype.hasOwnProperty.call(input, field)
        || input[field] === undefined) {
      fields[field] = 'required';
    } else if (typeof input[field] !== 'number' || !Number.isFinite(input[field])) {
      fields[field] = 'must be a finite number';
    }
  }
  if (!fields.trenchKm && input.trenchKm <= 0) {
    fields.trenchKm = 'must be greater than 0';
  }
  if (!fields.permitsMerged
      && (!Number.isInteger(input.permitsMerged) || input.permitsMerged < 1)) {
    fields.permitsMerged = 'must be a positive integer';
  }
  return { valid: Object.keys(fields).length === 0, fields };
}

async function handleJsonEndpoint(req, res, validate, execute) {
  try {
    const body = await readJsonBody(req);
    if (!isPlainObject(body)) {
      sendJson(res, 400, { error: 'INVALID_JSON_STRUCTURE' });
      return;
    }
    const validation = validate(body);
    if (!validation.valid) {
      sendJson(res, 422, {
        error: 'VALIDATION_ERROR',
        fields: validation.fields,
      });
      return;
    }
    sendJson(res, 200, execute(body));
  } catch (err) {
    if (err instanceof RequestBodyError) {
      sendJson(res, err.statusCode, { error: err.code });
      return;
    }
    sendJson(res, 500, { error: 'INTERNAL_ERROR' });
  }
}

async function handleApiScore(req, res) {
  return handleJsonEndpoint(req, res, validateScoreInput, (body) =>
    AtharEngine.score({ ...AtharEngine.DEFAULTS, ...body })
  );
}

async function handleApiOptimize(req, res) {
  return handleJsonEndpoint(req, res, validateScoreInput, (body) =>
    AtharEngine.optimize({ ...AtharEngine.DEFAULTS, ...body })
  );
}

async function handleApiDigOnce(req, res) {
  return handleJsonEndpoint(
    req,
    res,
    validateDigOnceInput,
    (body) => AtharEngine.digOnce(body)
  );
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

function createServer() {
  return http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, 'http://localhost');
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
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, () => {
    console.log(`Athar server listening on http://localhost:${PORT}`);
  });
}

module.exports = {
  createServer,
  validateScoreInput,
  validateDigOnceInput,
};
