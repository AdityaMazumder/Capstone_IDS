const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';
const mockModules = import.meta.glob('./mocks/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  if (USE_MOCKS) {
    console.log(`[Mock Fetch] ${options?.method || 'GET'} ${path}`);
    
    // For POST/PUT requests in mock mode, return fake success
    if (options?.method && options.method !== 'GET') {
      return { success: true, message: 'Mock POST successful' } as unknown as T;
    }
    
    if (path === '/') return { status: 'ONLINE' } as unknown as T;
    
    const url = new URL(path, 'http://localhost');
    const pathname = url.pathname;
    
    let mockFileName = '';
    
    if (pathname === '/api/metrics') mockFileName = 'metrics.json';
    else if (pathname === '/api/host/incidents') mockFileName = 'host_incidents.json';
    else if (pathname.startsWith('/api/incidents/')) {
        const parts = pathname.split('/');
        const id = parts[3];
        if (id === 'INC-001') mockFileName = 'incident_detail_1.json';
        else mockFileName = 'incident_detail_2.json';
    }
    else if (pathname === '/api/incidents') mockFileName = 'incidents.json';
    else if (pathname === '/api/blocks') mockFileName = 'blocks.json';
    else if (pathname === '/api/status') mockFileName = 'status.json';
    else {
      throw new Error(`No mock mapped for path: ${path}`);
    }

    try {
      const mockModule = mockModules[`./mocks/${mockFileName}`];
      if (mockModule === undefined) {
        throw new Error(`Mock module not found for ${mockFileName}`);
      }
      return mockModule as T;
    } catch (err) {
      console.error(`Failed to load mock file ${mockFileName}:`, err);
      throw new Error(`Failed to load mock file ${mockFileName}`);
    }
  }

  const url = `${BASE}${path}`;
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
