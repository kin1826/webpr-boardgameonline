import { afterEach, expect, it, vi } from 'vitest';
import { originAllowed } from './index';
afterEach(() => vi.unstubAllEnvs());
it('production không cho ngoại lệ dev/LAN, vẫn nhận origin explicit và same-origin', () => {
  vi.stubEnv('NODE_ENV', 'production');
  expect(originAllowed('http://localhost:5173', 'api.example.com', 'https', '')).toBe(false);
  expect(originAllowed('http://192.168.1.20:5173', 'api.example.com', 'https', '')).toBe(false);
  expect(originAllowed('https://club.example.com', 'api.example.com', 'https', 'https://club.example.com')).toBe(true);
  expect(originAllowed('https://api.example.com', 'api.example.com', 'https', '')).toBe(true);
  expect(originAllowed('http://api.example.com', 'api.example.com', 'https', '')).toBe(false);
});
it('development giữ HTTP LAN và localhost', () => {
  vi.stubEnv('NODE_ENV', 'development');
  expect(originAllowed('http://localhost:5173', '127.0.0.1:3001', 'http', '')).toBe(true);
  expect(originAllowed('http://192.168.1.20:5173', '127.0.0.1:3001', 'http', '')).toBe(true);
});
