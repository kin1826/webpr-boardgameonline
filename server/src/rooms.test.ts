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
  it('giữ hình đại diện theo ghế khi tham gia và nối lại', () => {
    const service = create();
    const host = service.create('Mít', 'private', 'h', 'uno', 9);
    const guest = service.join(host.room.code, 'Bắp', 'g', 3);
    const before = service.snapshot(host.room, host.seat.id).players;
    expect(before.map((player) => player.avatarId)).toEqual([9, 3]);
    service.resume(host.room.id, guest.seat.id, guest.credentials.token, 'g-new');
    expect(service.snapshot(host.room, host.seat.id).players.find((player) => player.id === guest.seat.id)?.avatarId).toBe(3);
  });
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
    service.create('Công khai','public','a','uno',7);
    const secret = service.create('Riêng tư','private','b');
    expect(service.publicRooms()).toHaveLength(1);
    expect(service.publicRooms()[0]?.code).not.toBe(secret.room.code);
    expect(service.publicRooms()[0]?.phase).toBe('waiting');
    expect(service.publicRooms()[0]?.hostName).toBe('Công khai');
    expect(service.publicRooms()[0]?.hostAvatarId).toBe(7);
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
    expect(host.room.notice).toMatch(/trận đã hủy/i);
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
    const host=service.create('Chủ','private','h','noitu',0,{ gameKey:'noitu', turnSeconds:30, targetScore:10 });const guest=service.join(host.room.code,'Khách','g');service.ready(host.room,guest.seat,true);service.start(host.room,host.seat);
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

describe('Phòng Caro HQ-CARO-1', () => {
  it('chỉ nhận tối đa 2 người, cần khách sẵn sàng; snapshot chia sẻ bàn và capabilities theo lượt', () => {
    const service = new RoomService({ randomInt: () => 0 }); services.push(service);
    expect(service.gameAvailable('caro')).toBe(true);
    const host = service.create('Chủ', 'public', 'h', 'caro');
    const guest = service.join(host.room.code, 'Khách', 'g');
    expect(host.room.gameKey).toBe('caro');
    expect(() => service.join(host.room.code, 'Người 3', '3')).toThrowError(expect.objectContaining({ code: 'ROOM_FULL' }));
    expect(() => service.start(host.room, host.seat)).toThrowError(expect.objectContaining({ code: 'NOT_READY' }));
    service.ready(host.room, guest.seat, true); service.start(host.room, host.seat);
    const hostView = service.snapshot(host.room, host.seat.id);
    const guestView = service.snapshot(host.room, guest.seat.id);
    expect(hostView.gameKey).toBe('caro');
    expect(hostView.minPlayers).toBe(2); expect(hostView.maxPlayers).toBe(2);
    expect(hostView.game).toMatchObject({ board: Array(225).fill(null), canPlace: true, yourSymbol: 'X' });
    expect(guestView.game).toMatchObject({ canPlace: false, yourSymbol: 'O', legalCellIndexes: [] });
    expect(JSON.stringify(hostView)).not.toContain('token');
  });

  it('timeout chốt đúng biên, resume giữ lại thời gian và callback cũ không tác động ván mới', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-15T12:00:00Z'));
    const service = new RoomService({ randomInt: () => 0 }); services.push(service);
    const host = service.create('Chủ', 'private', 'h', 'caro', 0, { gameKey:'caro', turnSeconds:30, targetScore:10, boardSize:15, winLength:5 }); const guest = service.join(host.room.code, 'Khách', 'g');
    service.ready(host.room, guest.seat, true); service.start(host.room, host.seat);
    const oldId = host.room.caroGame!.gameId;
    vi.advanceTimersByTime(8_000); service.disconnect(host.room.id, host.seat.id, 'h');
    expect(host.room.caroGame?.turnRemainingMs).toBe(22_000);
    vi.advanceTimersByTime(50_000); service.resume(host.room.id, host.seat.id, host.credentials.token, 'h2');
    expect(host.room.caroGame?.turnDeadlineAt).toBe(Date.now() + 22_000);
    await vi.advanceTimersByTimeAsync(21_999); expect(host.room.phase).toBe('playing');
    await vi.advanceTimersByTimeAsync(1); expect(host.room.phase).toBe('finished');
    expect(host.room.caroGame?.finishReason).toBe('timeout'); expect(host.room.caroGame?.winnerId).toBe(guest.seat.id);
    service.rematch(host.room, host.seat); service.ready(host.room, guest.seat, true); service.start(host.room, host.seat);
    expect(host.room.caroGame?.gameId).not.toBe(oldId);
    expect(host.room.caroGame?.players.find((player) => player.id === guest.seat.id)?.symbol).toBe('X');
  });

  it('hủy ván và dọn timer khi người chơi rời phòng', () => {
    vi.useFakeTimers();
    const service = new RoomService({ randomInt: () => 0 }); services.push(service);
    const host = service.create('Chủ', 'private', 'h', 'caro'); const guest = service.join(host.room.code, 'Khách', 'g');
    service.ready(host.room, guest.seat, true); service.start(host.room, host.seat);
    service.leave(host.room, guest.seat);
    expect(host.room.phase).toBe('waiting'); expect(host.room.caroGame).toBeNull(); expect(host.room.notice).toMatch(/trận bị hủy/iu);
    vi.advanceTimersByTime(40_000);
    expect(host.room.phase).toBe('waiting');
  });

  it('đổi thành viên thì bốc lại X thay vì đảo ký hiệu của cặp cũ', () => {
    const service = new RoomService({ randomInt: () => 0 }); services.push(service);
    const host = service.create('Chủ', 'private', 'h', 'caro', 0, { gameKey:'caro', turnSeconds:30, targetScore:10, boardSize:15, winLength:5 });
    const firstGuest = service.join(host.room.code, 'Khách cũ', 'g1');
    service.ready(host.room, firstGuest.seat, true); service.start(host.room, host.seat);
    const activeGame = host.room.caroGame!;
    service.caroAction(host.room, host.seat, host.room.revision, {
      actionId: 'resign-change-pair', roomId: host.room.id, expectedRevision: host.room.revision,
      gameId: activeGame.gameId, type: 'resign',
    });
    service.rematch(host.room, host.seat);
    service.leave(host.room, firstGuest.seat);
    const nextGuest = service.join(host.room.code, 'Khách mới', 'g2');
    service.ready(host.room, nextGuest.seat, true); service.start(host.room, host.seat);
    expect(host.room.caroGame!.players.find((player) => player.id === host.seat.id)?.symbol).toBe('X');
  });
});

describe('Trận nhiều ván, cài đặt và countdown server', () => {
  it('đổi settings chỉ qua host, reset ready và mang cấu hình vào snapshot/sảnh public', () => {
    const service = create();
    const host = service.create('Chủ', 'public', 'h', 'caro');
    const guest = service.join(host.room.code, 'Khách', 'g'); service.ready(host.room, guest.seat, true);
    const settings = { gameKey:'caro' as const, turnSeconds:45 as const, targetScore:100, boardSize:19 as const, winLength:6 as const };
    expect(() => service.updateSettings(host.room, guest.seat, settings)).toThrowError(expect.objectContaining({ code:'HOST_ONLY' }));
    service.updateSettings(host.room, host.seat, settings);
    expect(guest.seat.ready).toBe(false);
    expect(service.snapshot(host.room, guest.seat.id)).toMatchObject({ settings, caroWinLength:6 });
    service.create('UNO', 'public', 'u', 'uno', 0, { gameKey:'uno', turnSeconds:45, targetScore:100, stacking:false });
    expect(service.publicRooms()[0]).toMatchObject({ targetScore:100, turnSeconds:45, settings:{ gameKey:'uno', turnSeconds:45, targetScore:100, stacking:false } });
  });

  it('cộng +10 một lần, tự mở ván mới sau đúng 3 giây và giữ điểm/ghế dù không ready lại', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-16T12:00:00Z'));
    const service = create();
    const host = service.create('Chủ', 'private', 'h', 'caro', 0, { gameKey:'caro', turnSeconds:30, targetScore:50, boardSize:9, winLength:4 });
    const guest = service.join(host.room.code, 'Khách', 'g'); service.ready(host.room, guest.seat, true); service.start(host.room, host.seat);
    const firstId = host.room.caroGame!.gameId;
    service.caroAction(host.room, host.seat, host.room.revision, { actionId:'match-resign-1', roomId:host.room.id, expectedRevision:host.room.revision, gameId:firstId, type:'resign' });
    expect(host.room.match).toMatchObject({ status:'intermission', roundNumber:1, nextRoundAt:Date.now()+3_000, lastRound:{ winnerId:guest.seat.id, points:10 } });
    expect(host.room.match!.scores.get(guest.seat.id)).toBe(10);
    await vi.advanceTimersByTimeAsync(2_999);
    expect(host.room.caroGame!.gameId).toBe(firstId);
    await vi.advanceTimersByTimeAsync(1);
    expect(host.room.phase).toBe('playing'); expect(host.room.match).toMatchObject({ status:'active', roundNumber:2 });
    expect(host.room.match!.scores.get(guest.seat.id)).toBe(10);
    expect(host.room.caroGame!.gameId).not.toBe(firstId);
    expect(guest.seat.ready).toBe(true);
  });

  it('hủy countdown/trận nếu có người rời trong intermission, không để timer mở ván ma', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-16T12:00:00Z'));
    const service = create();
    const host = service.create('Chủ', 'private', 'h', 'caro', 0, { gameKey:'caro', turnSeconds:30, targetScore:50, boardSize:9, winLength:4 });
    const guest = service.join(host.room.code, 'Khách', 'g'); service.ready(host.room, guest.seat, true); service.start(host.room, host.seat);
    service.caroAction(host.room, host.seat, host.room.revision, { actionId:'match-resign-2', roomId:host.room.id, expectedRevision:host.room.revision, gameId:host.room.caroGame!.gameId, type:'resign' });
    const oldId = host.room.caroGame!.gameId;
    service.leave(host.room, guest.seat);
    expect(host.room.phase).toBe('waiting'); expect(host.room.match).toBeNull(); expect(host.room.caroGame).toBeNull();
    await vi.advanceTimersByTimeAsync(3_001);
    expect(host.room.phase).toBe('waiting'); expect(host.room.caroGame).toBeNull(); expect(host.room.match).toBeNull();
    expect(oldId).toBeTruthy();
  });

  it('tạm dừng phần còn lại của countdown khi mất kết nối, nối lại cùng roster và tiếp tục', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-16T12:00:00Z'));
    const service = create();
    const host = service.create('Chủ', 'private', 'h', 'caro', 0, { gameKey:'caro', turnSeconds:30, targetScore:50, boardSize:9, winLength:4 });
    const guest = service.join(host.room.code, 'Khách', 'g'); service.ready(host.room, guest.seat, true); service.start(host.room, host.seat);
    service.caroAction(host.room, host.seat, host.room.revision, { actionId:'match-resign-3', roomId:host.room.id, expectedRevision:host.room.revision, gameId:host.room.caroGame!.gameId, type:'resign' });
    await vi.advanceTimersByTimeAsync(1_000);
    service.disconnect(host.room.id, guest.seat.id, 'g');
    expect(host.room.match?.remainingMs).toBe(2_000);
    await vi.advanceTimersByTimeAsync(5_000);
    service.resume(host.room.id, guest.seat.id, guest.credentials.token, 'g-new');
    expect(host.room.match?.nextRoundAt).toBe(Date.now()+2_000);
    await vi.advanceTimersByTimeAsync(1_999); expect(host.room.match?.roundNumber).toBe(1);
    await vi.advanceTimersByTimeAsync(1); expect(host.room.match?.roundNumber).toBe(2);
  });

  it('UNO timeout loại lượt hiện tại, giữ tay bài và chốt trận khi chỉ còn một active', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-16T12:00:00Z'));
    const service = create();
    const host = service.create('Chủ', 'private', 'h', 'uno', 0, { gameKey:'uno', turnSeconds:15, targetScore:10, stacking:true });
    const guest = service.join(host.room.code, 'Khách', 'g'); service.ready(host.room, guest.seat, true); service.start(host.room, host.seat);
    const timedOutId = host.room.game!.currentPlayerId;
    const handCount = host.room.game!.players.find((player) => player.id === timedOutId)!.hand.length;
    await vi.advanceTimersByTimeAsync(15_000);
    expect(host.room.game?.phase).toBe('finished'); expect(host.room.game?.finishReason).toBe('lastActive');
    const timedOutPlayer = host.room.game?.players.find((player) => player.id === timedOutId);
    expect(timedOutPlayer?.status).toBe('eliminated'); expect(timedOutPlayer?.hand).toHaveLength(handCount);
    expect(host.room.match).toMatchObject({ status:'finished', targetScore:10, roundNumber:1 });
    expect(host.room.match!.scores.get(timedOutId === host.seat.id ? guest.seat.id : host.seat.id)).toBe(10);
  });
});

it('chỉ host Caro được đổi số quân trong sảnh, reset ready, đồng bộ và giữ cấu hình rematch', () => {
  const service = new RoomService({ randomInt: () => 0 }); services.push(service);
  const host = service.create('Chủ', 'private', 'h', 'caro', 0, { gameKey:'caro', turnSeconds:30, targetScore:10, boardSize:15, winLength:5 }); const guest = service.join(host.room.code, 'Khách', 'g');
  service.ready(host.room, guest.seat, true);
  expect(() => service.setCaroWinLength(host.room, guest.seat, 4)).toThrow();
  service.setCaroWinLength(host.room, host.seat, 4);
  expect(guest.seat.ready).toBe(false);
  expect(service.snapshot(host.room, guest.seat.id)).toMatchObject({ caroWinLength: 4 });
  expect(() => service.start(host.room, host.seat)).toThrow();
  service.ready(host.room, guest.seat, true); service.start(host.room, host.seat);
  expect(host.room.caroGame!.winLength).toBe(4);
  expect(() => service.setCaroWinLength(host.room, host.seat, 6)).toThrow();
  service.caroAction(host.room, host.seat, host.room.revision, { actionId: 'resign-settings', roomId: host.room.id, gameId: host.room.caroGame!.gameId, expectedRevision: host.room.revision, type: 'resign' });
  service.rematch(host.room, host.seat);
  expect(service.snapshot(host.room, guest.seat.id)).toMatchObject({ caroWinLength: 4 });
});
