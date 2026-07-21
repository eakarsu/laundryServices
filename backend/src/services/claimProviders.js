const crypto = require('crypto');

class ProviderConfigurationError extends Error {}

function requireHttpsUrl(name, value) {
  if (!value) throw new ProviderConfigurationError(`${name} is required`);
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new ProviderConfigurationError(`${name} must use HTTPS`);
  return url.toString().replace(/\/$/, '');
}

class JsonProviderClient {
  constructor(name, baseUrl, token) {
    this.name = name;
    this.baseUrl = requireHttpsUrl(`${name.toUpperCase()}_URL`, baseUrl);
    if (!token || token.length < 16) {
      throw new ProviderConfigurationError(`${name.toUpperCase()}_TOKEN must be at least 16 characters`);
    }
    this.token = token;
  }

  async request(path, body, idempotencyKey) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/json',
        'idempotency-key': idempotencyKey || crypto.randomUUID(),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const detail = await response.text();
      const error = new Error(`${this.name} returned ${response.status}: ${detail.slice(0, 200)}`);
      error.code = `PROVIDER_${response.status}`;
      throw error;
    }
    return response.json();
  }
}

function providersFromEnvironment(env = process.env) {
  const storage = new JsonProviderClient('storage', env.CLAIM_STORAGE_URL, env.CLAIM_STORAGE_TOKEN);
  const ocr = new JsonProviderClient('ocr', env.CLAIM_OCR_URL, env.CLAIM_OCR_TOKEN);
  const signature = new JsonProviderClient('signature', env.CLAIM_ESIGN_URL, env.CLAIM_ESIGN_TOKEN);
  const filing = new JsonProviderClient('filing', env.CLAIM_FILING_URL, env.CLAIM_FILING_TOKEN);
  const templates = new JsonProviderClient('template', env.CLAIM_TEMPLATE_URL, env.CLAIM_TEMPLATE_TOKEN);

  return {
    storage: {
      put: (input) => storage.request('/v1/objects', input, input.idempotencyKey),
      dispose: (input) => storage.request('/v1/dispositions', input, input.idempotencyKey),
    },
    ocr: {
      extract: (input) => ocr.request('/v1/extractions', input, input.idempotencyKey),
    },
    signature: {
      request: (input) => signature.request('/v1/envelopes', input, input.idempotencyKey),
      status: (input) => signature.request('/v1/envelopes/status', input, input.idempotencyKey),
    },
    filing: {
      submit: (input) => filing.request('/v1/submissions', input, input.idempotencyKey),
    },
    templates: {
      fetch: (input) => templates.request('/v1/templates/resolve', input, input.idempotencyKey),
    },
  };
}

module.exports = {
  JsonProviderClient,
  ProviderConfigurationError,
  providersFromEnvironment,
  requireHttpsUrl,
};
