const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  if (USE_MOCKS) {
    const mockFile = endpoint.split('?')[0].replace(/^\/api\//, '').replace(/\//g, '_');
    try {
      const res = await fetch(`/src/api/mocks/${mockFile}.json`);
      if (!res.ok) throw new Error('Mock not found');
      return res.json();
    } catch (e) {
      console.warn(`Mock failed for ${endpoint}, falling back to empty.`, e);
      throw e;
    }
  }

  const res = await fetch(`${API_BASE}${endpoint}`, options);
  if (!res.ok) {
    throw new Error(`API error: ${res.statusText}`);
  }
  return res.json();
}
