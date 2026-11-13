import { expect, it } from 'vitest';
import { roomJoinSchema } from '../packages/shared/src/index';
import { createActionId } from './action-id';

it('tạo UUID hợp lệ khi HTTP LAN không cung cấp randomUUID', () => {
  const source = { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) };
  const ids = Array.from({ length: 100 }, () => createActionId(source));
  expect(new Set(ids).size).toBe(100);
  for (const actionId of ids) expect(roomJoinSchema.safeParse({ actionId, code: 'ABC234', nickname: 'Khách' }).success).toBe(true);
});

it('dùng randomUUID khi trình duyệt có hỗ trợ', () => {
  const id = '76762a4c-64c3-4398-8070-333c7213794d';
  expect(createActionId({ randomUUID: () => id, getRandomValues: () => { throw new Error('Không cần fallback'); } })).toBe(id);
});
