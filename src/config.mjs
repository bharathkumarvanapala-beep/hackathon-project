/**
 * Aarogya Drishti — Central Application Configuration
 *
 * This module defines and validates all configuration parameters for the application.
 * Centralizing configuration ensures:
 * 1. Safe defaults for local development.
 * 2. Explicit validation for production and LAN deployments.
 * 3. Prevention of hardcoded secrets or arbitrary environment reads scattered across the codebase.
 */

import { isIPv4 } from 'node:net';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Validates and normalizes an integer within a specified range.
 *
 * @param {string|number|undefined} value - Raw value to parse.
 * @param {number} fallback - Default if not provided.
 * @param {number} min - Minimum allowed value.
 * @param {number} max - Maximum allowed value.
 * @param {string} fieldName - Descriptive name for error messages.
 * @returns {number}
 */
export function parseInteger(value, fallback, min, max, fieldName) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new RangeError(`${fieldName} must be an integer between ${min} and ${max}. Got: ${value}`);
  }
  return parsed;
}

/**
 * Validates and normalizes a boolean flag.
 *
 * @param {string|boolean|undefined} value - Raw value.
 * @param {boolean} fallback - Default value.
 * @returns {boolean}
 */
export function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

/**
 * Loads and validates configuration from environment variables and explicit overrides.
 *
 * @param {object} [overrides={}] - Explicit runtime options (e.g. from tests or CLI).
 * @param {object} [env=process.env] - Environment variable store.
 * @returns {object} Validated configuration object.
 */
export function loadConfig(overrides = {}, env = process.env) {
  const host = overrides.host || env.HOST || '127.0.0.1';
  const port = parseInteger(overrides.port ?? env.PORT, 4173, 0, 65535, 'PORT');

  const lanHost = overrides.lanHost || env.LAN_HOST || '';
  if (lanHost) {
    const isPrivateIpv4 = /^(10\.(?:\d{1,3}\.){2}\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/;
    if (!isIPv4(lanHost) || !isPrivateIpv4.test(lanHost)) {
      throw new TypeError('LAN_HOST must be an explicit private IPv4 address (e.g. 192.168.1.100).');
    }
  }
  const lanPort = parseInteger(overrides.lanPort ?? env.LAN_PORT, 4174, 1, 65535, 'LAN_PORT');

  const projectRoot = existsSync(resolve('public')) ? process.cwd() : resolve(import.meta.dirname, '..');
  const dataDir = resolve(overrides.dataDir || env.DATA_DIR || resolve(projectRoot, '.local'));
  const storageDir = resolve(overrides.storageDir || env.STORAGE_DIR || resolve(dataDir, 'storage'));
  const imagesDir = resolve(storageDir, 'images');
  const publicDir = resolve(overrides.publicDir || env.PUBLIC_DIR || resolve(projectRoot, 'public'));

  // Security controls: Secure cookies must be used in production behind HTTPS.
  const cookieSecure = parseBoolean(overrides.cookieSecure ?? env.COOKIE_SECURE, false);
  const trustCloudflare = parseBoolean(overrides.trustCloudflare ?? env.TRUST_CLOUDFLARE, false);

  // AI Inference settings
  const aiPythonCommand = overrides.aiPython || env.DRISHTI_AI_PYTHON || '';
  const aiTimeoutMs = parseInteger(overrides.aiTimeoutMs ?? env.AI_TIMEOUT_MS, 25000, 1000, 120000, 'AI_TIMEOUT_MS');

  // Automation & n8n integration
  const n8nWebhookUrl = overrides.n8nWebhookUrl || env.N8N_WEBHOOK_URL || '';
  const n8nWebhookToken = overrides.n8nWebhookToken || env.N8N_WEBHOOK_TOKEN || '';
  const n8nCallbackToken = overrides.n8nCallbackToken || env.N8N_CALLBACK_TOKEN || '';

  // Voice telephony settings (Bolna provider)
  const voiceCallingEnabled = parseBoolean(overrides.voiceCallingEnabled ?? env.VOICE_CALLING_ENABLED, false);
  const bolnaApiKey = overrides.bolnaApiKey || env.BOLNA_API_KEY || '';
  const bolnaAgentTe = overrides.bolnaAgentTe || env.BOLNA_AGENT_TE || '';
  const bolnaAgentEn = overrides.bolnaAgentEn || env.BOLNA_AGENT_EN || '';
  const voiceDailyLimit = parseInteger(overrides.voiceDailyLimit ?? env.VOICE_DAILY_LIMIT, 5, 1, 100, 'VOICE_DAILY_LIMIT');

  // LiveKit WebRTC Configuration
  const livekitUrl = overrides.livekitUrl || env.LIVEKIT_URL || 'ws://127.0.0.1:7880';
  const livekitApiKey = overrides.livekitApiKey || env.LIVEKIT_API_KEY || 'devkey';
  const livekitApiSecret = overrides.livekitApiSecret || env.LIVEKIT_API_SECRET || 'secret';

  return Object.freeze({
    server: {
      host,
      port,
      lanHost,
      lanPort,
      cookieSecure,
      trustCloudflare,
    },
    paths: {
      dataDir,
      storageDir,
      imagesDir,
      publicDir,
    },
    ai: {
      pythonCommand: aiPythonCommand,
      timeoutMs: aiTimeoutMs,
      defaultModel: 'Al04ni/Umlomo',
      candidateModel: 'prithivMLmods/tooth-agenesis-siglip2',
    },
    automation: {
      n8nWebhookUrl,
      n8nWebhookToken,
      n8nCallbackToken,
    },
    voice: {
      enabled: voiceCallingEnabled,
      bolnaApiKey,
      bolnaAgentTe,
      bolnaAgentEn,
      dailyLimit: voiceDailyLimit,
    },
    livekit: {
      url: livekitUrl,
      apiKey: livekitApiKey,
      apiSecret: livekitApiSecret,
    },
  });
}
