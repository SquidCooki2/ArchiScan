const test = require('node:test');
const assert = require('node:assert/strict');
const { extractJson } = require('../lib/extractJson');
const { validateWalls } = require('../lib/validateWalls');
const { createApp } = require('../app');

const WALL = { type: 'wall', floor: 0, x: 2, z: 0.1, width: 4, depth: 0.2, rotation: 0 };

test('extractJson: plain, fenced, prose-wrapped, garbage', () => {
  const json = JSON.stringify([WALL]);
  assert.deepEqual(extractJson(json), [WALL]);
  assert.deepEqual(extractJson('```json\n' + json + '\n```'), [WALL]);
  assert.deepEqual(extractJson('Here you go: ' + json + ' Enjoy!'), [WALL]);
  assert.throws(() => extractJson('no json here'));
  assert.throws(() => extractJson('{"a":1}'));
  assert.throws(() => extractJson(''));
});

test('validateWalls: valid, default type and floor, coercion, rounding, rotation', () => {
  const out = validateWalls([{ x: '1.23456', z: 2, width: 3, depth: 0.2, rotation: -Math.PI / 2, extra: 1 }]);
  assert.deepEqual(out, [{ type: 'wall', floor: 0, x: 1.235, z: 2, width: 3, depth: 0.2, rotation: 1.571 }]);
  const floor2 = validateWalls([{ x: 1, z: 2, width: 3, depth: 0.2, rotation: 0 }], 2);
  assert.equal(floor2[0].floor, 2);
  assert.deepEqual(validateWalls([]), []);
});

test('validateWalls: window and door types with default and custom sillHeight/height', () => {
  const out = validateWalls([
    { type: 'window', x: 2, z: 0.1, width: 1.2, depth: 0.2, rotation: 0 },
    { type: 'door', x: 4, z: 0.1, width: 0.9, depth: 0.2, rotation: 0, sillHeight: 0, height: 2.05 },
  ]);
  assert.deepEqual(out, [
    { type: 'window', floor: 0, x: 2, z: 0.1, width: 1.2, depth: 0.2, rotation: 0, sillHeight: 0.9, height: 1.2 },
    { type: 'door', floor: 0, x: 4, z: 0.1, width: 0.9, depth: 0.2, rotation: 0, sillHeight: 0, height: 2.05 },
  ]);
  assert.throws(() => validateWalls([{ ...WALL, type: 'roof' }]));
});

test('validateWalls: furniture types omit width/depth, support aliases, and preserve [0, 2*PI) rotation', () => {
  const out = validateWalls([
    { type: 'couch', x: 2.5, z: 3.1, rotation: Math.PI },
    { type: 'Cabinets', x: 10.1, z: 2.0, rotation: 1.5 * Math.PI, width: 99 },
    { type: 'bathtub', x: 6.2, z: 7.4, rotation: -Math.PI / 2 },
  ], 1);
  assert.deepEqual(out, [
    { type: 'couch', floor: 1, x: 2.5, z: 3.1, rotation: 3.142 },
    { type: 'cabinet', floor: 1, x: 10.1, z: 2, rotation: 4.712 },
    { type: 'bath', floor: 1, x: 6.2, z: 7.4, rotation: 4.712 },
  ]);
});

test('validateWalls: drops few invalid, rejects many invalid', () => {
  const good = Array.from({ length: 9 }, () => WALL);
  assert.equal(validateWalls([...good, { x: 'a' }]).length, 9);
  assert.throws(() => validateWalls([WALL, { x: 1 }]));
  assert.throws(() => validateWalls([{ ...WALL, width: 0 }]));
});

// ---- Route tests with mocked claude service ----
const config = { corsOrigin: 'http://localhost:5173', maxImageBytes: 100 };
const IMG = Buffer.from('hello').toString('base64');

async function withServer(claude, fn) {
  const server = createApp({ config, claude }).listen(0);
  const base = `http://localhost:${server.address().port}`;
  const originalLog = console.log;
  console.log = () => {};
  try {
    await fn(async (path, body) => {
      const res = await fetch(base + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: typeof body === 'string' ? body : body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: res.status, body: await res.json() };
    });
  } finally {
    console.log = originalLog;
    server.close();
  }
}

const okClaude = { parseBlueprintImage: async () => JSON.stringify([WALL]) };
const post = '/api/parse-blueprint';

test('health', async () => {
  await withServer(okClaude, async (req) => {
    const r = await req('/api/health');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { status: 'ok' });
  });
});

test('200 success, data URL accepted', async () => {
  await withServer(okClaude, async (req) => {
    const r = await req(post, { image: `data:image/png;base64,${IMG}` });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, [WALL]);
  });
});

test('200 multi-floor images array tags floor 0, 1, ... in order', async () => {
  await withServer(okClaude, async (req) => {
    const r = await req(post, {
      images: [
        { image: IMG, mediaType: 'image/png' },
        `data:image/png;base64,${IMG}`,
      ],
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.length, 2);
    assert.equal(r.body[0].floor, 0);
    assert.equal(r.body[1].floor, 1);
  });
});

test('400 invalid requests (single and multi-floor)', async () => {
  await withServer(okClaude, async (req) => {
    const invalidBodies = [
      {},
      { image: 5 },
      { image: '!!notbase64!!' },
      { image: IMG, mediaType: 'image/bmp' },
      { images: [] },
      { images: Array.from({ length: 6 }, () => ({ image: IMG })) },
      { images: [{ image: IMG }, { image: '!!bad!!' }] },
    ];
    for (const body of invalidBodies) {
      const r = await req(post, body);
      assert.equal(r.status, 400);
      assert.equal(r.body.error.code, 'INVALID_REQUEST');
    }
    const bad = await req(post, '{not json');
    assert.equal(bad.status, 400);
  });
});

test('413 image too large', async () => {
  await withServer(okClaude, async (req) => {
    const r = await req(post, { image: Buffer.alloc(500).toString('base64') });
    assert.equal(r.status, 413);
    assert.equal(r.body.error.code, 'IMAGE_TOO_LARGE');

    const rMulti = await req(post, { images: [{ image: IMG }, { image: Buffer.alloc(500).toString('base64') }] });
    assert.equal(rMulti.status, 413);
    assert.equal(rMulti.body.error.code, 'IMAGE_TOO_LARGE');
  });
});

test('422 no walls', async () => {
  await withServer({ parseBlueprintImage: async () => '[]' }, async (req) => {
    const r = await req(post, { image: IMG });
    assert.equal(r.status, 422);
    assert.equal(r.body.error.code, 'NO_WALLS_FOUND');
  });
});

test('retry once then succeed; 502 when still invalid', async () => {
  let calls = 0;
  const flaky = { parseBlueprintImage: async () => (++calls === 1 ? 'oops' : JSON.stringify([WALL])) };
  await withServer(flaky, async (req) => {
    const r = await req(post, { image: IMG });
    assert.equal(r.status, 200);
    assert.equal(calls, 2);
  });

  calls = 0;
  const bad = { parseBlueprintImage: async () => (calls++, 'nope') };
  await withServer(bad, async (req) => {
    const r = await req(post, { image: IMG });
    assert.equal(r.status, 502);
    assert.equal(r.body.error.code, 'MODEL_OUTPUT_INVALID');
    assert.equal(calls, 2);
  });
});

test('upstream errors map to 429 / 502 / 504 / 500', async () => {
  const Anthropic = require('@anthropic-ai/sdk');
  const cases = [
    [new Anthropic.RateLimitError(429, undefined, 'rl', new Headers({ 'retry-after': '7' })), 429, 'RATE_LIMITED'],
    [new Anthropic.AuthenticationError(401, undefined, 'auth', new Headers()), 502, 'UPSTREAM_AUTH'],
    [new Anthropic.APIConnectionTimeoutError(), 504, 'UPSTREAM_TIMEOUT'],
    [new Error('boom'), 500, 'INTERNAL'],
  ];
  const origErr = console.error;
  console.error = () => {};
  try {
    for (const [err, status, code] of cases) {
      await withServer({ parseBlueprintImage: async () => { throw err; } }, async (req) => {
        const r = await req(post, { image: IMG });
        assert.equal(r.status, status);
        assert.equal(r.body.error.code, code);
      });
    }
  } finally {
    console.error = origErr;
  }
});
