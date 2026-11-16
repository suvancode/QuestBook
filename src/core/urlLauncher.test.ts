import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILT_IN_PROVIDERS,
  buildProviderLaunchUrl,
  selectProvidersForLaunch,
  validateProviderUrlTemplate,
} from './urlLauncher';

test('validateProviderUrlTemplate accepts valid https/http templates and rejects dangerous schemes', () => {
  assert.equal(validateProviderUrlTemplate('https://www.google.com/search?q={query}').valid, true);
  assert.equal(validateProviderUrlTemplate('http://localhost:8080/search?q={query}').valid, true);
  assert.equal(validateProviderUrlTemplate('javascript:alert(1)').valid, false);
  assert.equal(validateProviderUrlTemplate('data:text/html,<script>alert(1)</script>').valid, false);
  assert.equal(validateProviderUrlTemplate('vbscript:msgbox(1)').valid, false);
  assert.equal(validateProviderUrlTemplate('not-a-url').valid, false);
});

test('buildProviderLaunchUrl encodes query parameters properly and handles homepage-only providers', () => {
  const brave = BUILT_IN_PROVIDERS.find((p) => p.id === 'brave')!;
  const built = buildProviderLaunchUrl(brave, 'How does 3D Secure & OAuth 2.0 work?');
  assert.equal(built.supportsQueryTemplate, true);
  assert.equal(
    built.url,
    'https://search.brave.com/search?q=How%20does%203D%20Secure%20%26%20OAuth%202.0%20work%3F',
  );

  const homepageOnly = buildProviderLaunchUrl(
    { urlTemplate: 'https://arxiv.org', homepageUrl: 'https://arxiv.org' },
    'quantum error correction',
  );
  assert.equal(homepageOnly.supportsQueryTemplate, false);
  assert.equal(homepageOnly.url, 'https://arxiv.org');
});

test('selectProvidersForLaunch handles Search All enabled vs checklist selection and respects disabled state', () => {
  const custom = BUILT_IN_PROVIDERS.map((p) =>
    p.id === 'bing' ? { ...p, enabled: false } : p,
  );
  const allEnabled = selectProvidersForLaunch(custom, 'all_enabled');
  assert.equal(allEnabled.some((p) => p.id === 'bing'), false);
  assert.equal(allEnabled.length, BUILT_IN_PROVIDERS.length - 1);

  const selected = selectProvidersForLaunch(custom, 'selected', ['perplexity', 'claude']);
  assert.deepEqual(
    selected.map((p) => p.id),
    ['claude', 'perplexity'], // sorted by displayOrder
  );
});
