import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../src/server.mjs';
import {
  parseImageDimensions,
  computeLaplacianVariance,
  analyzePixelArray,
  generateQualityReport,
  assessImageQuality,
  QUALITY_FEEDBACK
} from '../src/image-quality.mjs';
import { SYNTHETIC_PNG_BASE64 } from '../src/synthetic-data.mjs';
import { generatePatientId } from '../src/patient-id.mjs';

test('server-side image quality pipeline: blur, illumination, contrast, and bilingual guidance', async () => {
  // 1. Binary dimension parsing from PNG headers
  const pngRaw = Buffer.from(SYNTHETIC_PNG_BASE64.split(',')[1], 'base64');
  const pngDims = parseImageDimensions(pngRaw);
  assert.equal(pngDims.format, 'png');
  assert.equal(pngDims.width, 1);
  assert.equal(pngDims.height, 1);

  // Non-image or truncated buffer returns null
  assert.equal(parseImageDimensions(Buffer.from('not an image at all')), null);

  // 2. Laplacian variance on sharp vs blurred patterns
  const width = 20;
  const height = 20;
  const sharp = new Float64Array(width * height);
  // High-frequency alternating checkerboard (sharp edges)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      sharp[y * width + x] = (x + y) % 2 === 0 ? 30 : 220;
    }
  }
  const sharpVariance = computeLaplacianVariance(sharp, width, height);
  assert.ok(sharpVariance > 500, `Sharp pattern must have high Laplacian variance, got ${sharpVariance}`);

  // Flat / uniform pattern (zero gradient / completely blurred)
  const blurred = new Float64Array(width * height).fill(128);
  const blurredVariance = computeLaplacianVariance(blurred, width, height);
  assert.equal(blurredVariance, 0);

  // 3. Illumination & Contrast analysis on raw pixel arrays
  const testW = 50;
  const testH = 50;

  // Dark image: Y = 10
  const darkPixels = new Uint8ClampedArray(testW * testH * 4).fill(10);
  const darkReport = generateQualityReport(analyzePixelArray(darkPixels, testW, testH));
  assert.equal(darkReport.pass, false);
  assert.ok(darkReport.issues.includes('TOO_DARK'));
  assert.ok(darkReport.feedback.en.some((f) => f.includes('too dark')));
  assert.ok(darkReport.feedback.te.some((f) => f.includes('చీకటిగా ఉంది')));

  // Glared / over-exposed image: Y = 250
  const glaredPixels = new Uint8ClampedArray(testW * testH * 4).fill(250);
  const glaredReport = generateQualityReport(analyzePixelArray(glaredPixels, testW, testH));
  assert.equal(glaredReport.pass, false);
  assert.ok(glaredReport.issues.includes('TOO_BRIGHT_GLARE'));
  assert.ok(glaredReport.feedback.en.some((f) => f.includes('glare') || f.includes('overexposure')));
  assert.ok(glaredReport.feedback.te.some((f) => f.includes('మెరుపు')));

  // Low-contrast flat gray image: Y = 128
  const flatPixels = new Uint8ClampedArray(testW * testH * 4).fill(128);
  const flatReport = generateQualityReport(analyzePixelArray(flatPixels, testW, testH));
  assert.equal(flatReport.pass, false);
  assert.ok(flatReport.issues.includes('LOW_CONTRAST'));
  assert.ok(flatReport.feedback.en.some((f) => f.includes('low contrast')));
  assert.ok(flatReport.feedback.te.some((f) => f.includes('కాంట్రాస్ట్')));

  // 4. Well-balanced synthetic image passes
  const goodReport = generateQualityReport({
    width: 640,
    height: 480,
    brightness: 130,
    contrast: 42,
    blurScore: 180,
    glareRatio: 0.02,
    darkRatio: 0.05,
    detail: 6
  });
  assert.equal(goodReport.pass, true);
  assert.equal(goodReport.status, 'passed');
  assert.ok(goodReport.score >= 80);
  assert.equal(goodReport.issues.length, 0);
  assert.ok(goodReport.feedback.en[0].includes('meets basic quality standards'));
  assert.ok(goodReport.feedback.te[0].includes('నాణ్యతా ప్రమాణాలకు అనుగుణంగా ఉంది'));

  // 5. Server integration: POST /api/images/quality-check
  const directory = await mkdtemp(join(tmpdir(), 'drishti-quality-server-'));
  const server = await startServer({
    port: 0,
    dataDir: directory,
    storageDir: directory
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const accounts = JSON.parse(await readFile(join(directory, 'demo-accounts.json'), 'utf8')).accounts;

  const request = async (path, method = 'GET', data, auth) => {
    const r = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(auth ? { Cookie: auth.cookie, 'X-CSRF-Token': auth.csrf } : {})
      },
      ...(data ? { body: JSON.stringify(data) } : {})
    });
    return { status: r.status, body: await r.json(), cookie: r.headers.get('set-cookie') };
  };

  try {
    const signIn = async (role) => {
      const a = accounts.find((acc) => acc.role === role);
      const r = await request('/api/auth/login', 'POST', { email: a.email, password: a.password });
      return { cookie: r.cookie.split(';')[0], csrf: r.body.csrf, user: r.body.user };
    };

    const worker = await signIn('worker');

    // Unauthenticated quality check returns 401
    const unauthCheck = await request('/api/images/quality-check', 'POST', { photo: SYNTHETIC_PNG_BASE64 });
    assert.equal(unauthCheck.status, 401);

    // Missing photo returns 400
    const missingPhotoCheck = await request('/api/images/quality-check', 'POST', {}, worker);
    assert.equal(missingPhotoCheck.status, 400);

    // Valid authenticated quality check returns report
    const checkRes = await request(
      '/api/images/quality-check',
      'POST',
      { photo: SYNTHETIC_PNG_BASE64 },
      worker
    );
    assert.equal(checkRes.status, 200);
    assert.equal(checkRes.body.ok, true);
    assert.ok(typeof checkRes.body.quality.pass === 'boolean');
    assert.ok(typeof checkRes.body.quality.score === 'number');
    assert.ok(Array.isArray(checkRes.body.quality.feedback.en));
    assert.ok(Array.isArray(checkRes.body.quality.feedback.te));

    // Register patient and attach photo with quality check
    const patientId = generatePatientId('AD-PAD');
    await request(
      '/api/patients',
      'POST',
      {
        id: patientId,
        name: 'Gangaraju Pangi',
        age: 39,
        village: 'Dumbriguda',
        consent: true,
        consentVersion: 'v1.0-ITDA',
        consentLanguage: 'te',
        photo: SYNTHETIC_PNG_BASE64
      },
      worker
    );

    // Upload an updated photo via POST /api/patients/:id/image
    const uploadRes = await request(
      `/api/patients/${patientId}/image`,
      'POST',
      { photo: SYNTHETIC_PNG_BASE64 },
      worker
    );
    assert.equal(uploadRes.status, 200);
    assert.equal(uploadRes.body.ok, true);
    assert.ok(uploadRes.body.quality);
    assert.ok(typeof uploadRes.body.quality.score === 'number');
    assert.equal(uploadRes.body.patient.quality.pass, uploadRes.body.quality.pass);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
