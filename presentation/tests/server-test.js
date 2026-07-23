'use strict';

const assert = require('node:assert');
const { createServer, validateScoreInput } = require('../server.js');

let passed = 0;

async function test(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

async function withServer(run) {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())
    );
  }
}

async function postRaw(baseUrl, route, raw) {
  const response = await fetch(baseUrl + route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw,
  });
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch (error) {
    body = text;
  }
  return { status: response.status, body };
}

async function post(baseUrl, route, body) {
  return postRaw(baseUrl, route, JSON.stringify(body));
}

const validScoreInput = {
  aadt: 85000,
  lanes: 4,
  lanesClosed: 1,
  startHour: 22,
  durationHours: 10,
};

(async () => {
  await test('importing the server module does not open a port', async () => {
    const server = createServer();
    assert.strictEqual(server.listening, false);
  });

  await test('empty request body is rejected with 422', async () => {
    await withServer(async (baseUrl) => {
      const result = await postRaw(baseUrl, '/api/score', '');
      assert.strictEqual(result.status, 422);
      assert.strictEqual(result.body.error, 'VALIDATION_ERROR');
      assert.strictEqual(result.body.fields.aadt, 'required');
    });
  });

  await test('empty object is rejected with required field errors', async () => {
    await withServer(async (baseUrl) => {
      const result = await post(baseUrl, '/api/score', {});
      assert.strictEqual(result.status, 422);
      assert.strictEqual(result.body.error, 'VALIDATION_ERROR');
      for (const field of ['aadt', 'lanes', 'lanesClosed', 'startHour', 'durationHours']) {
        assert.strictEqual(result.body.fields[field], 'required');
      }
    });
  });

  await test('one missing field returns the stable validation shape', async () => {
    await withServer(async (baseUrl) => {
      const { aadt, ...withoutAadt } = validScoreInput;
      void aadt;
      const result = await post(baseUrl, '/api/score', withoutAadt);
      assert.strictEqual(result.status, 422);
      assert.deepStrictEqual(result.body, {
        error: 'VALIDATION_ERROR',
        fields: { aadt: 'required' },
      });
    });
  });

  await test('numeric strings are rejected instead of coerced', async () => {
    await withServer(async (baseUrl) => {
      const result = await post(baseUrl, '/api/score', {
        ...validScoreInput,
        aadt: '85000',
      });
      assert.strictEqual(result.status, 422);
      assert.strictEqual(result.body.fields.aadt, 'must be a finite number');
    });
  });

  await test('non-finite values are rejected by the unit validation path', async () => {
    const validation = validateScoreInput({
      ...validScoreInput,
      aadt: Infinity,
    });
    assert.strictEqual(validation.valid, false);
    assert.strictEqual(validation.fields.aadt, 'must be a finite number');
  });

  await test('closed lanes cannot exceed total lanes', async () => {
    await withServer(async (baseUrl) => {
      const result = await post(baseUrl, '/api/score', {
        ...validScoreInput,
        lanesClosed: 5,
      });
      assert.strictEqual(result.status, 422);
      assert.strictEqual(result.body.fields.lanesClosed, 'must be between 1 and lanes');
    });
  });

  await test('malformed JSON returns 400 without becoming a validation error', async () => {
    await withServer(async (baseUrl) => {
      const result = await postRaw(baseUrl, '/api/score', '{"aadt":');
      assert.strictEqual(result.status, 400);
      assert.deepStrictEqual(result.body, { error: 'INVALID_JSON' });
    });
  });

  await test('invalid JSON structure returns 400', async () => {
    await withServer(async (baseUrl) => {
      const result = await post(baseUrl, '/api/score', []);
      assert.strictEqual(result.status, 400);
      assert.deepStrictEqual(result.body, { error: 'INVALID_JSON_STRUCTURE' });
    });
  });

  await test('oversized body returns 413', async () => {
    await withServer(async (baseUrl) => {
      const raw = JSON.stringify({ padding: 'x'.repeat(1024 * 1024) });
      const result = await postRaw(baseUrl, '/api/score', raw);
      assert.strictEqual(result.status, 413);
      assert.deepStrictEqual(result.body, { error: 'PAYLOAD_TOO_LARGE' });
    });
  });

  await test('valid minimum score request returns a finite impact result', async () => {
    await withServer(async (baseUrl) => {
      const result = await post(baseUrl, '/api/score', validScoreInput);
      assert.strictEqual(result.status, 200);
      assert.ok(Number.isFinite(result.body.delayVehHours));
      assert.ok(result.body.delayVehHours > 0);
    });
  });

  await test('valid optimize request returns exact selected windows', async () => {
    await withServer(async (baseUrl) => {
      const result = await post(baseUrl, '/api/optimize', validScoreInput);
      assert.strictEqual(result.status, 200);
      assert.ok(Array.isArray(result.body.top3));
      assert.ok(Array.isArray(result.body.top3[0].windows));
      assert.strictEqual(
        result.body.top3[0].windows.reduce((sum, window) => sum + window.durationHours, 0),
        validScoreInput.durationHours
      );
    });
  });

  console.log(`ALL SERVER TESTS PASSED (${passed})`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
