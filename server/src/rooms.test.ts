import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoomError, RoomService } from './rooms.ts';

let services: RoomService[] = [];
function create() {
  const service = new RoomService();
  services.push(service);
  return service;
}
afterEach(() => { for (const service of services) service.destroyAll(); services = []; vi.useRealTimers(); });

describe('Phòng UNO và quyền dùng chung', () => {
  it.each([2,3,4,5,6])('bắt đầu với %i người, không cần kín ghế', count => {
    const service = create();
    const host = service.create('Chủ phòng','private','socket-host');
    const guests = Array.from({ length: count - 1 }, (_, i) => service.join(host.room.code,'Khách '+i,'socket-'+i));
    for (const guest of guests) service.ready(host.room,guest.seat,true);
    expect(service.snapshot(host.room,host.seat.id).canStart).toBe(true);
    service.start(host.room,host.seat);
    expect(host.room.phase).toBe('playing');
    expect(host.room.game?.players).toHaveLength(count);
  });
  it('chỉ liệt kê phòng public và chỉ phòng chờ còn chỗ', () => {
    const service = create();
    service.create('Công khai','public','a');
    const secret = service.create('Riêng tư','private','b');
    expect(service.publicRooms()).toHaveLength(1);
    expect(service.publicRooms()[0]?.code).not.toBe(secret.room.code);
    expect(service.publicRooms()[0]?.phase).toBe('waiting');
  });
  it('chủ phòng không cần ready; khách chưa sẵn sàng chặn start', () => {
    const service = create(); const host = service.create('Host','private','h'); const guest = service.join(host.room.code,'Khách','g');
    expect(() => service.start(host.room,host.seat)).toThrowError(RoomError);
    expect(() => service.ready(host.room,host.seat,true)).toThrow(/Chủ phòng/);
    expect(() => service.start(host.room,host.seat)).toThrow(/sẵn sàng/);
    service.ready(host.room,guest.seat,true);
    expect(() => service.start(host.room,host.seat)).not.toThrow();
  });
  it('thay đổi thành viên reset ready và guest không thể đổi public/kick', () => {
    const service = create(); const host = service.create('Host','public','h'); const one = service.join(host.room.code,'Một','1');
    service.ready(host.room,one.seat,true);
    service.join(host.room.code,'Hai','2');
    expect([...host.room.players.values()].some(p => p.ready)).toBe(false);
    expect(() => service.setVisibility(host.room,one.seat,'private')).toThrow(/chủ phòng/);
    expect(() => service.kick(host.room,one.seat,host.seat.id)).toThrow(/chủ phòng/);
  });
  it('kick trong sảnh thu hồi token/ghế; kick giữa ván hủy ván', () => {
    const service = create(); const host = service.create('Host','private','h'); const guest = service.join(host.room.code,'Khách','g');
    service.kick(host.room,host.seat,guest.seat.id);
    expect(host.room.players.has(guest.seat.id)).toBe(false);
    expect(() => service.verifySession(host.room.id,guest.seat.id,guest.credentials.token)).toThrow();
    const second = service.join(host.room.code,'Khách 2','g2');
    service.ready(host.room,second.seat,true); service.start(host.room,host.seat);
    const kicked = service.kick(host.room,host.seat,second.seat.id);
    expect(kicked.wasPlaying).toBe(true);
    expect(host.room.phase).toBe('waiting'); expect(host.room.game).toBeNull();
    expect(host.room.notice).toMatch(/ván đã hủy/i);
  });
  it('reconnect khôi phục cùng ghế và thu hồi socket cũ', () => {
    const revoked: string[] = [];
    const service = new RoomService({ onRevoke: id => revoked.push(id) }); services.push(service);
    const host = service.create('Host','private','old-socket');
    const resumed = service.resume(host.room.id,host.seat.id,host.credentials.token,'new-socket');
    expect(resumed.seat.id).toBe(host.seat.id);
    expect(resumed.generation).toBe(2);
    expect(service.isCurrentSocket(host.room.id,host.seat.id,'old-socket',1)).toBe(false);
    expect(service.isCurrentSocket(host.room.id,host.seat.id,'new-socket',2)).toBe(true);
    expect(revoked).toContain('old-socket');
    expect(() => service.resume(host.room.id,host.seat.id,'invalid','third')).toThrow();
  });
  it('mất kết nối trong sảnh hủy trạng thái sẵn sàng và resume không tự sẵn sàng lại', () => {
    const service = create(); const host = service.create('Host','private','h'); const guest = service.join(host.room.code,'Khách','g');
    service.ready(host.room,guest.seat,true);
    service.disconnect(host.room.id,guest.seat.id,'g');
    expect(guest.seat.ready).toBe(false);
    const resumed = service.resume(host.room.id,guest.seat.id,guest.credentials.token,'g2');
    expect(resumed.seat.ready).toBe(false);
    expect(service.snapshot(host.room,host.seat.id).canStart).toBe(false);
  });
  it('hết hạn ghế offline khi chờ và dọn phòng khi không còn người', async () => {
    vi.useFakeTimers();
    const service = create(); const host = service.create('Host','private','h');
    service.disconnect(host.room.id,host.seat.id,'h');
    await vi.advanceTimersByTimeAsync(90_001);
    expect(() => service.getRoom(host.room.id)).toThrow();
  });
});


describe('Lifecycle notifications',()=>{
  it('host reload giữ phòng và game, timeout broadcast thay đổi cho khách',async()=>{
    vi.useFakeTimers(); const changed=vi.fn();const closed=vi.fn();
    const service=new RoomService({onChanged:changed,onClosed:closed});services.push(service);
    const h=service.create('Host','private','h');const g=service.join(h.room.code,'Guest','g');service.ready(h.room,g.seat,true);service.start(h.room,h.seat);
    const gameId=h.room.game!.gameId;
    service.disconnect(h.room.id,h.seat.id,'h');expect(h.room.pauseStartedAt).not.toBeNull();
    service.resume(h.room.id,h.seat.id,h.credentials.token,'h2');expect(h.room.game!.gameId).toBe(gameId);expect(h.room.players.size).toBe(2);expect(h.room.pauseStartedAt).toBeNull();
    service.disconnect(h.room.id,h.seat.id,'h2');changed.mockClear();await vi.advanceTimersByTimeAsync(90_001);
    expect(changed).toHaveBeenCalledWith(h.room.id);expect(h.room.phase).toBe('waiting');expect(h.room.notice).toMatch(/hủy/);expect(closed).not.toHaveBeenCalled();
  });
  it('TTL đóng phòng thông báo tất cả socket trước khi room bị xóa',async()=>{
    vi.useFakeTimers();const closed=vi.fn();const service=new RoomService({onClosed:closed});services.push(service);
    const h=service.create('H','public','h'),g=service.join(h.room.code,'G','g');
    await vi.advanceTimersByTimeAsync(1_800_001);
    expect(closed).toHaveBeenCalledWith(expect.objectContaining({roomId:h.room.id,message:expect.any(String)}),expect.arrayContaining(['h','g']));
    expect(()=>service.getRoom(h.room.id)).toThrow();expect(()=>service.resume(h.room.id,g.seat.id,g.credentials.token,'g2')).toThrow();
  });
});
