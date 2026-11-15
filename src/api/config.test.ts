import { describe, expect, it } from 'vitest';
import { backendApiUrl, createBackendApiConfig } from './config';

describe('cấu hình URL backend cho frontend', () => {
  it('dùng same-origin khi cấu hình để trống', () => {
    expect(createBackendApiConfig('', 'http://localhost:5173/')).toEqual({ backendOrigin: '' });
    expect(backendApiUrl('/api/games', '')).toBe('/api/games');
  });

  it('chuẩn hóa dấu gạch cuối và dùng cùng origin cho API', () => {
    const config = createBackendApiConfig('https://api.example.com/', 'https://game.example.com/');
    expect(config.backendOrigin).toBe('https://api.example.com');
    expect(backendApiUrl('/api/rooms', config.backendOrigin)).toBe('https://api.example.com/api/rooms');
  });

  it.each([
    ['file:///tmp/backend', 'http://game.example.com/'],
    ['https://api.example.com/v1', 'https://game.example.com/'],
    ['https://user:secret@api.example.com', 'https://game.example.com/'],
    ['https://api.example.com?token=secret', 'https://game.example.com/'],
    ['http://api.example.com', 'https://game.example.com/'],
  ])('rejects unsafe or invalid target %s', (backend, page) => {
    expect(() => createBackendApiConfig(backend, page)).toThrow(/VITE_BACKEND_URL|HTTPS/);
  });
});
