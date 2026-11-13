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

describe('Phòng Nối từ và timer theo game',()=>{
  const noitu={dictionary:{version:'room-fixture',has:(word:string)=>['nấu cơm','cơm nước','nước lọc'].includes(word),isDenied:(word:string)=>word==='cơm cấm'},seedWords:['nấu cơm']};
  it.each([2,3,4,5,6])('chạy được phòng Nối từ với %i người và không chiếu state UNO',count=>{
    const service=new RoomService({noitu,randomInt:()=>0});services.push(service);
    const host=service.create('Chủ','private','h','noitu');
    const guests=Array.from({length:count-1},(_,i)=>service.join(host.room.code,'Khách '+i,'g'+i));
    for(const guest of guests)service.ready(host.room,guest.seat,true);
    service.start(host.room,host.seat);
    const snapshot=service.snapshot(host.room,host.seat.id);
    expect(snapshot.gameKey).toBe('noitu');expect(snapshot.phase).toBe('playing');
    expect((snapshot.game as {currentWord:string}).currentWord).toBe('nấu cơm');
    expect(JSON.stringify(snapshot)).not.toContain('usedWords');
    expect(JSON.stringify(snapshot)).not.toContain('drawPile');
    expect(snapshot.players.every(player=>player.cardCount===undefined)).toBe(true);
  });

  it('mỗi phòng giữ riêng game, sai gameId và sai event game bị chặn',()=>{
    let randomCounter=0;const service=new RoomService({noitu,randomInt:(max)=>{const value=randomCounter%max;randomCounter++;return value;}});services.push(service);
    const u=service.create('UNO','private','u');const n=service.create('Từ','private','n','noitu');
    const ug=service.join(u.room.code,'U2','u2');const ng=service.join(n.room.code,'N2','n2');
    service.ready(u.room,ug.seat,true);service.ready(n.room,ng.seat,true);service.start(u.room,u.seat);service.start(n.room,n.seat);
    expect(u.room.game).not.toBeNull();expect(u.room.noituGame).toBeNull();
    expect(n.room.game).toBeNull();expect(n.room.noituGame).not.toBeNull();
    expect(()=>service.gameAction(n.room,n.seat,n.room.revision,{type:'draw'})).toThrowError(/không dùng được/);
  });

  it('unknown proposal giữ turn và chuyển lượt chỉ sau phiếu quyết định',()=>{
    const service=new RoomService({noitu,randomInt:()=>0});services.push(service);
    const host=service.create('Chủ','private','h','noitu');const guest=service.join(host.room.code,'Khách','g');service.ready(host.room,guest.seat,true);service.start(host.room,host.seat);
    const game=host.room.noituGame!;const base={roomId:host.room.id,gameId:game.gameId,turnId:game.turnId};
    service.noituAction(host.room,host.seat,host.room.revision,{...base,actionId:'e5e71e07-8bd3-48d4-9eb6-8fd01a5ead77',expectedRevision:host.room.revision,type:'submit',suffix:'lạ'});
    expect(host.room.noituGame?.phase).toBe('voting');expect(host.room.noituGame?.currentWord).toBe('nấu cơm');
    const proposal=host.room.noituGame!.proposal!;
    service.noituAction(host.room,guest.seat,host.room.revision,{...base,actionId:'341d4c12-ad86-48f9-b95c-a2c02d530a80',expectedRevision:host.room.revision,type:'vote',proposalId:proposal.id,decision:'accept'});
    expect(host.room.noituGame?.phase).toBe('turn');expect(host.room.noituGame?.currentWord).toBe('cơm lạ');expect(host.room.noituGame?.currentPlayerId).toBe(guest.seat.id);
  });

  it('draft realtime chỉ nhận lượt hiện hành, sequence cũ bị loại, draft không bump revision',()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-13T12:00:00Z'));
    const changed=vi.fn();const service=new RoomService({noitu,randomInt:()=>0,onNoituDraft:changed});services.push(service);
    const host=service.create('Chủ','private','h','noitu');const guest=service.join(host.room.code,'Khách','g');service.ready(host.room,guest.seat,true);service.start(host.room,host.seat);
    const state=host.room.noituGame!;const rev=host.room.revision;
    const draft={roomId:host.room.id,gameId:state.gameId,turnId:state.turnId,sequence:1,suffix:'nư'};
    const notice=service.updateNoituDraft(host.room,host.seat,draft);
    expect(notice.prefix).toBe('cơm');expect(notice.suffix).toBe('nư');expect(host.room.revision).toBe(rev);
    expect(service.snapshot(host.room,guest.seat.id).game).not.toHaveProperty('draft');
    expect(()=>service.updateNoituDraft(host.room,host.seat,{...draft,sequence:1,suffix:'cũ'})).toThrowError(/cũ/);
    expect(changed).toHaveBeenCalledWith(host.room.id,notice);
  });

  it('clear draft khi proposal mở đặt lại sequence để người chơi nhập lại sau khi bị bác',()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-13T12:00:00Z'));
    const service=new RoomService({noitu,randomInt:()=>0});services.push(service);
    const host=service.create('Chủ','private','h','noitu');const guest=service.join(host.room.code,'Khách','g');service.ready(host.room,guest.seat,true);service.start(host.room,host.seat);
    const game=host.room.noituGame!;const base={roomId:host.room.id,gameId:game.gameId,turnId:game.turnId};
    service.updateNoituDraft(host.room,host.seat,{...base,sequence:1,suffix:'lạ'});
    service.noituAction(host.room,host.seat,host.room.revision,{...base,actionId:'7fa91140-2edb-4d62-b5d1-36c1c16bd685',expectedRevision:host.room.revision,type:'submit',suffix:'lạ'});
    const proposal=host.room.noituGame!.proposal!;
    service.noituAction(host.room,guest.seat,host.room.revision,{...base,actionId:'1e9ae910-4961-4e61-afdb-97f8e89035bb',expectedRevision:host.room.revision,type:'vote',proposalId:proposal.id,decision:'reject'});
    expect(host.room.noituGame?.phase).toBe('turn');
    expect(service.updateNoituDraft(host.room,host.seat,{...base,sequence:1,suffix:'mới'}).suffix).toBe('mới');
  });

  it('deadline lượt kết thúc đúng biên, người hết giờ bị loại và callback cũ không phá rematch',async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-13T12:00:00Z'));
    const service=new RoomService({noitu,randomInt:()=>0});services.push(service);
    const host=service.create('Chủ','private','h','noitu');const guest=service.join(host.room.code,'Khách','g');service.ready(host.room,guest.seat,true);service.start(host.room,host.seat);
    const oldGameId=host.room.noituGame!.gameId;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(host.room.phase).toBe('finished');expect(host.room.noituGame?.winnerId).toBe(guest.seat.id);
    service.rematch(host.room,host.seat);service.ready(host.room,guest.seat,true);service.start(host.room,host.seat);
    expect(host.room.noituGame?.gameId).not.toBe(oldGameId);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(host.room.phase).toBe('finished');expect(host.room.noituGame?.gameId).not.toBe(oldGameId);
  });

  it('mất kết nối tạm dừng đúng thời gian còn lại, resume tiếp tục chứ không tặng lượt mới',()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-13T12:00:00Z'));
    const service=new RoomService({noitu,randomInt:()=>0});services.push(service);
    const host=service.create('Chủ','private','h','noitu');const guest=service.join(host.room.code,'Khách','g');service.ready(host.room,guest.seat,true);service.start(host.room,host.seat);
    vi.advanceTimersByTime(9_000);service.disconnect(host.room.id,host.seat.id,'h');
    expect(host.room.noituGame?.turnRemainingMs).toBe(21_000);expect(host.room.noituGame?.turnDeadlineAt).toBeNull();
    vi.advanceTimersByTime(50_000);service.resume(host.room.id,host.seat.id,host.credentials.token,'h2');
    expect(host.room.pauseStartedAt).toBeNull();expect(host.room.noituGame?.turnDeadlineAt).toBe(Date.now()+21_000);
  });
});
