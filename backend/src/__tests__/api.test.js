const test = require('node:test');
const assert = require('node:assert/strict');
const { extractJson } = require('../lib/extractJson');
const { validateWalls } = require('../lib/validateWalls');
const { vectorizeMasks } = require('../services/maskRcnn');
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

test('validateWalls: stairs requires width/depth, normalizes aliases, and preserves [0, 2*PI) rotation', () => {
  const out = validateWalls([
    { type: 'staircase', x: 11.45, z: 5.8, width: 3.4, depth: 1.1, rotation: Math.PI },
  ], 0);
  assert.deepEqual(out, [
    { type: 'stairs', floor: 0, x: 11.45, z: 5.8, width: 3.4, depth: 1.1, rotation: 3.142 },
  ]);
  assert.throws(() => validateWalls([{ type: 'stairs', x: 1, z: 2, rotation: 0 }]));
});

test('validateWalls: drops few invalid, rejects many invalid', () => {
  const good = Array.from({ length: 9 }, () => WALL);
  assert.equal(validateWalls([...good, { x: 'a' }]).length, 9);
  assert.throws(() => validateWalls([WALL, { x: 1 }]));
  assert.throws(() => validateWalls([{ ...WALL, width: 0 }]));
});

test('maskRcnn.vectorizeMasks: converts wall, window, door, and furniture pixel masks into elements', () => {
  const w = 10;
  const h = 10;
  const wallMask = new Uint8Array(w * h);
  // Horizontal wall from x=1..8, y=1
  for (let x = 1; x <= 8; x++) wallMask[1 * w + x] = 1;

  const couchMask = new Uint8Array(w * h);
  for (let y = 4; y <= 5; y++) for (let x = 4; x <= 5; x++) couchMask[y * w + x] = 1;

  const elements = validateWalls(
    vectorizeMasks(
      {
        width: w,
        height: h,
        classes: { wall: wallMask, couch: couchMask },
        orientations: { couch: [Math.PI] },
      },
      0.5
    )
  );
  assert.equal(elements.length, 2);
  assert.equal(elements[0].type, 'wall');
  assert.equal(elements[0].width, 4);
  assert.equal(elements[1].type, 'couch');
  assert.equal(elements[1].rotation, 3.142);
});

// ---- Route tests with mocked claude service ----
const config = { corsOrigin: 'http://localhost:5173', maxImageBytes: 100 };
const IMG = Buffer.from('hello').toString('base64');

async function withServer(claude, fn, maskRcnn) {
  const server = createApp({ config, claude, maskRcnn }).listen(0);
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

test('200 uses primary Mask R-CNN segmentation when weights are present, falls back to Claude when absent', async () => {
  let claudeCalled = false;
  const fallbackClaude = {
    parseBlueprintImage: async () => {
      claudeCalled = true;
      return JSON.stringify([WALL]);
    },
  };
  const cnnWall = { type: 'wall', floor: 0, x: 5, z: 2, width: 6, depth: 0.25, rotation: 0 };
  const activeMaskRcnn = {
    hasTrainedWeights: () => true,
    parseBlueprintImage: async () => [cnnWall],
  };

  await withServer(
    fallbackClaude,
    async (req) => {
      const r = await req(post, { image: IMG });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body, [cnnWall]);
      assert.equal(claudeCalled, false);
    },
    activeMaskRcnn
  );
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

// ---- Evacuation brief ----
const FACTS = {
  outcome: 'route',
  rooms: [{ id: 0, name: 'Room 1' }, { id: 1, name: 'Room 2' }],
  steps: ['Walk 2.5 m to the door.'],
};

test('POST /api/evacuation-brief returns the brief and keeps only names of real rooms', async () => {
  let received;
  const claude = {
    writeEvacuationBrief: async (facts, image) => {
      received = { facts, image };
      return { brief: ' Go now. ', roomNames: [{ id: 1, name: 'Kitchen' }, { id: 9, name: 'Invented' }, { id: 0, name: '' }] };
    },
  };
  await withServer(claude, async (post) => {
    const res = await post('/api/evacuation-brief', { facts: FACTS, image: IMG, mediaType: 'image/png' });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { brief: 'Go now.', roomNames: [{ id: 1, name: 'Kitchen' }] });
    assert.deepEqual(received.facts, FACTS);
    assert.equal(received.image.mediaType, 'image/png');
  });
});

test('POST /api/evacuation-brief works without an image', async () => {
  let received = 'unset';
  const claude = { writeEvacuationBrief: async (facts, image) => { received = image; return { brief: 'Go now.', roomNames: [] }; } };
  await withServer(claude, async (post) => {
    const res = await post('/api/evacuation-brief', { facts: FACTS });
    assert.equal(res.status, 200);
    assert.equal(received, null);
  });
});

test('POST /api/evacuation-brief rejects bad facts, big images, and unusable model output', async () => {
  const good = { writeEvacuationBrief: async () => ({ brief: 'Go.', roomNames: [] }) };
  await withServer(good, async (post) => {
    assert.equal((await post('/api/evacuation-brief', {})).status, 400);
    assert.equal((await post('/api/evacuation-brief', { facts: { ...FACTS, outcome: 'guess' } })).status, 400);
    assert.equal((await post('/api/evacuation-brief', { facts: { ...FACTS, steps: [1] } })).status, 400);
    const big = Buffer.alloc(200).toString('base64');
    assert.equal((await post('/api/evacuation-brief', { facts: FACTS, image: big })).status, 413);
  });
  const bad = { writeEvacuationBrief: async () => ({ brief: '  ', roomNames: [] }) };
  await withServer(bad, async (post) => {
    const res = await post('/api/evacuation-brief', { facts: FACTS });
    assert.equal(res.status, 502);
    assert.equal(res.body.error.code, 'MODEL_OUTPUT_INVALID');
  });
});
