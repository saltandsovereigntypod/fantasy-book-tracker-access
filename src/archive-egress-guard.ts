const ARCHIVE_ROUTE = '/rest/v1/archive_states';
const CACHE_TTL_MS = 30000;

type CachedResponse = {
  response: Response;
  expiresAt: number;
};

const originalFetch = window.fetch.bind(window);
const inflight = new Map<string, Promise<Response>>();
const cache = new Map<string, CachedResponse>();

function requestDetails(input: RequestInfo | URL, init?: RequestInit): { url: string; method: string; auth: string } {
  const request = input instanceof Request ? input : undefined;
  const url = request?.url || String(input);
  const method = String(init?.method || request?.method || 'GET').toUpperCase();
  const headers = new Headers(request?.headers || undefined);
  if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  return { url, method, auth: headers.get('authorization') || '' };
}

function isArchiveRequest(url: string): boolean {
  try {
    return new URL(url, window.location.href).pathname.includes(ARCHIVE_ROUTE);
  } catch {
    return url.includes('archive_states');
  }
}

function clearArchiveCache(): void {
  cache.clear();
  inflight.clear();
}

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const { url, method, auth } = requestDetails(input, init);
  if (!isArchiveRequest(url)) return originalFetch(input, init);

  if (method !== 'GET') {
    clearArchiveCache();
    const response = await originalFetch(input, init);
    clearArchiveCache();
    return response;
  }

  const key = `${auth}\n${url}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.response.clone();
  if (cached) cache.delete(key);

  const pending = inflight.get(key);
  if (pending) return (await pending).clone();

  const request = originalFetch(input, init)
    .then(async (response) => {
      if (response.ok) {
        cache.set(key, {
          response: response.clone(),
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
      }
      return response;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, request);
  return (await request).clone();
};
