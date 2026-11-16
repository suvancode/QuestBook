import { SearchProvider } from '../types/questbook';

export const BUILT_IN_PROVIDERS: SearchProvider[] = [
  {
    id: 'google',
    name: 'Google Search',
    type: 'search_engine',
    urlTemplate: 'https://www.google.com/search?q={query}',
    homepageUrl: 'https://www.google.com',
    iconKey: 'search',
    enabled: true,
    isDefault: true,
    isBuiltIn: true,
    displayOrder: 1,
    updatedAt: 0,
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    type: 'search_engine',
    urlTemplate: 'https://duckduckgo.com/?q={query}',
    homepageUrl: 'https://duckduckgo.com',
    iconKey: 'shield',
    enabled: true,
    isDefault: false,
    isBuiltIn: true,
    displayOrder: 2,
    updatedAt: 0,
  },
  {
    id: 'bing',
    name: 'Bing',
    type: 'search_engine',
    urlTemplate: 'https://www.bing.com/search?q={query}',
    homepageUrl: 'https://www.bing.com',
    iconKey: 'globe',
    enabled: true,
    isDefault: false,
    isBuiltIn: true,
    displayOrder: 3,
    updatedAt: 0,
  },
  {
    id: 'brave',
    name: 'Brave Search',
    type: 'search_engine',
    urlTemplate: 'https://search.brave.com/search?q={query}',
    homepageUrl: 'https://search.brave.com',
    iconKey: 'compass',
    enabled: true,
    isDefault: false,
    isBuiltIn: true,
    displayOrder: 4,
    updatedAt: 0,
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    type: 'ai_assistant',
    urlTemplate: 'https://chatgpt.com/?q={query}',
    homepageUrl: 'https://chatgpt.com',
    iconKey: 'sparkles',
    enabled: true,
    isDefault: false,
    isBuiltIn: true,
    displayOrder: 5,
    updatedAt: 0,
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    type: 'ai_assistant',
    urlTemplate: 'https://gemini.google.com/app?q={query}',
    homepageUrl: 'https://gemini.google.com',
    iconKey: 'cpu',
    enabled: true,
    isDefault: false,
    isBuiltIn: true,
    displayOrder: 6,
    updatedAt: 0,
  },
  {
    id: 'claude',
    name: 'Claude',
    type: 'ai_assistant',
    urlTemplate: 'https://claude.ai/new?q={query}',
    homepageUrl: 'https://claude.ai',
    iconKey: 'message',
    enabled: true,
    isDefault: false,
    isBuiltIn: true,
    displayOrder: 7,
    updatedAt: 0,
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    type: 'ai_assistant',
    urlTemplate: 'https://www.perplexity.ai/search?q={query}',
    homepageUrl: 'https://www.perplexity.ai',
    iconKey: 'radar',
    enabled: true,
    isDefault: false,
    isBuiltIn: true,
    displayOrder: 8,
    updatedAt: 0,
  },
  {
    id: 'grok',
    name: 'Grok',
    type: 'ai_assistant',
    urlTemplate: 'https://grok.com/?q={query}',
    homepageUrl: 'https://grok.com',
    iconKey: 'zap',
    enabled: true,
    isDefault: false,
    isBuiltIn: true,
    displayOrder: 9,
    updatedAt: 0,
  },
  {
    id: 'copilot',
    name: 'Microsoft Copilot',
    type: 'ai_assistant',
    urlTemplate: 'https://copilot.microsoft.com/?q={query}',
    homepageUrl: 'https://copilot.microsoft.com',
    iconKey: 'bot',
    enabled: true,
    isDefault: false,
    isBuiltIn: true,
    displayOrder: 10,
    updatedAt: 0,
  },
  {
    id: 'you',
    name: 'You.com',
    type: 'ai_assistant',
    urlTemplate: 'https://you.com/search?q={query}',
    homepageUrl: 'https://you.com',
    iconKey: 'layers',
    enabled: true,
    isDefault: false,
    isBuiltIn: true,
    displayOrder: 11,
    updatedAt: 0,
  },
];

export interface UrlValidationResult {
  valid: boolean;
  error?: string;
}

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export function validateProviderUrlTemplate(rawUrl: string): UrlValidationResult {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, error: 'URL template is required.' };
  }
  // Reject dangerous schemes before URL parsing
  if (/^(javascript|data|vbscript|file|blob):/i.test(trimmed)) {
    return { valid: false, error: 'Unsafe URL scheme rejected. Only https:// or http:// URLs are allowed.' };
  }
  const testSample = trimmed.replaceAll('{query}', 'test');
  try {
    const parsed = new URL(testSample);
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      return { valid: false, error: `Protocol "${parsed.protocol}" is not allowed. Use https:// or http://.` };
    }
    if (!parsed.hostname) {
      return { valid: false, error: 'URL must include a valid hostname.' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format. Example: https://search.brave.com/search?q={query}' };
  }
}

export function buildProviderLaunchUrl(
  provider: Pick<SearchProvider, 'urlTemplate' | 'homepageUrl'>,
  query: string,
): { url: string; supportsQueryTemplate: boolean } {
  const trimmedTemplate = provider.urlTemplate.trim();
  const validation = validateProviderUrlTemplate(trimmedTemplate || provider.homepageUrl);
  if (!validation.valid) {
    throw new Error(validation.error ?? 'Invalid provider URL.');
  }

  const encoded = encodeURIComponent(query.trim());
  if (trimmedTemplate.includes('{query}')) {
    return {
      url: trimmedTemplate.replaceAll('{query}', encoded),
      supportsQueryTemplate: true,
    };
  }

  // Homepage-only fallback when no {query} placeholder is supported
  return {
    url: trimmedTemplate || provider.homepageUrl,
    supportsQueryTemplate: false,
  };
}

export function selectProvidersForLaunch(
  providers: SearchProvider[],
  mode: 'all_enabled' | 'selected',
  selectedIds?: string[],
): SearchProvider[] {
  const sorted = [...providers].sort((a, b) => a.displayOrder - b.displayOrder);
  if (mode === 'all_enabled') {
    return sorted.filter((p) => p.enabled);
  }
  const idSet = new Set(selectedIds ?? []);
  return sorted.filter((p) => idSet.has(p.id));
}
