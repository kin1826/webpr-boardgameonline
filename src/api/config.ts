export type BackendApiConfig = { backendOrigin: string };

export class BackendConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackendConfigurationError';
  }
}

export function createBackendApiConfig(
  configuredUrl: string | undefined = import.meta.env.VITE_BACKEND_URL,
  pageUrl: string | undefined = typeof window === 'undefined' ? undefined : window.location.href,
): BackendApiConfig {
  const value = configuredUrl?.trim() ?? '';
  if (!value) return { backendOrigin: '' };

  let backend: URL;
  try {
    backend = new URL(value);
  } catch {
    throw new BackendConfigurationError('VITE_BACKEND_URL phải là một origin HTTP(S), ví dụ https://api.example.com.');
  }

  if (!['http:', 'https:'].includes(backend.protocol) || backend.username || backend.password || backend.pathname !== '/' || backend.search || backend.hash) {
    throw new BackendConfigurationError('VITE_BACKEND_URL chỉ được chứa origin HTTP(S), không có path, thông tin đăng nhập hoặc query.');
  }

  if (pageUrl) {
    let page: URL;
    try { page = new URL(pageUrl); }
    catch { throw new BackendConfigurationError('Không xác định được địa chỉ website hiện tại để kiểm tra kết nối máy chủ.'); }
    if (page.protocol === 'https:' && backend.protocol !== 'https:') {
      throw new BackendConfigurationError('Website đang dùng HTTPS nên VITE_BACKEND_URL cũng phải dùng HTTPS để kết nối an toàn.');
    }
  }

  return { backendOrigin: backend.origin };
}

export function backendApiUrl(path: `/api/${string}` | '/health', backendOrigin: string): string {
  return backendOrigin ? new URL(path, backendOrigin).toString() : path;
}
