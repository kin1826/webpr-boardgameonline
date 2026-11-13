import { afterEach, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import { createRealtimeServer } from './index.ts';
import { RoomService } from './rooms.ts';
import type { UnoCard } from '@banban/uno';

type Result = { ok: boolean; code?: string; message?: string; snapshot?: any; credentials?: { roomId: string; roomCode: string; playerId: string; token: string } };
function emitAck(socket: Socket, event: string, payload?: unknown): Promise<Result> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('ACK timeout: ' + event)), 3000);
    const callback = (value: Result) => { clearTimeout(timeout); resolve(value); };
    if (payload === undefined) socket.emit(event, callback);
    else socket.emit(event, payload, callback);
  });
}
function action(roomId: string, expectedRevision: number, extra = {}) {
  return { actionId: crypto.randomUUID(), roomId, expectedRevision, ...extra };
}
function fixtureCard(id: string, color: UnoCard['color'], value: number): UnoCard {
  return { id, color, type: 'number', value };
}
class FixtureRoomService extends RoomService {
  override start(room: ReturnType<RoomService['getRoom']>, actor: ReturnType<RoomService['getSeat']>) {
    super.start(room, actor);
    const game = room.game!; const [first, second] = game.players;
    first!.hand = [fixtureCard('fixture-a-red-5','red',5), ...Array.from({length:6},(_,i)=>fixtureCard('fixture-a-blue-'+i,'blue',i))];
    second!.hand = [fixtureCard('fixture-b-red-7','red',7)];
    game.discardPile = [fixtureCard('fixture-top-red-2','red',2)]; game.drawPile = [];
    game.currentColor = 'red'; game.direction = 1; game.currentPlayerId = first!.id;
    game.phase = 'turn'; game.drawnCardId = null; game.pendingPenalty = null; game.unoWindow = null;
    game.winnerId = null; game.finishReason = null; game.revision = 0;
  }
}
function legal(card: any, game: any) {
  if (!game.topCard) return true;
  if (card.type === 'wild') return true;
  if (card.type === 'wildDrawFour') return !game.hand.some((own: any) => own.id !== card.id && own.color === game.currentColor);
  if (card.color === game.currentColor) return true;
  if (card.type === 'number' && game.topCard.type === 'number' && card.value === game.topCard.value) return true;
  return card.type !== 'number' && card.type === game.topCard.type;
}
let active: ReturnType<typeof createRealtimeServer> | undefined;
let clients: Socket[] = [];
afterEach(async () => {
  for (const client of clients) client.disconnect();
  clients = [];
  if (active) {
    const app = active; active = undefined;
    app.rooms.destroyAll();
    await new Promise<void>(resolve => app.io.close(() => resolve()));
  }
});

describe('Socket.IO với hai client riêng', () => {
  it('tạo → mã tham gia → sẵn sàng → bắt đầu, chỉ phát tay riêng và chống action lặp', async () => {
    active = createRealtimeServer({ serveWeb: false, roomService: new FixtureRoomService() });
    await new Promise<void>(resolve => active!.http.listen(0, '127.0.0.1', resolve));
    const address = active.http.address();
    if (!address || typeof address === 'string') throw new Error('Không lấy được cổng test.');
    const url = 'http://127.0.0.1:' + address.port;
    const outsider = connect(url, { forceNew: true, transports: ['websocket'], reconnection: false, extraHeaders: { Origin: 'https://not-allowed.example' } });
    clients.push(outsider);
    const originError = await new Promise<Error>(resolve => outsider.once('connect_error', resolve));
    expect(originError).toBeTruthy();
    outsider.disconnect();
    const sameOrigin = connect(url, { forceNew: true, transports: ['websocket'], reconnection: false, extraHeaders: { Origin: url } });
    clients.push(sameOrigin);
    await new Promise<void>((resolve, reject) => { sameOrigin.once('connect', resolve); sameOrigin.once('connect_error', reject); });
    sameOrigin.disconnect();
    const a = connect(url, { forceNew: true, transports: ['websocket'], reconnection: false });
    const b = connect(url, { forceNew: true, transports: ['websocket'], reconnection: false });
    clients.push(a,b);
    let latestA: any; let latestB: any;
    a.on('room:snapshot', snapshot => { latestA = snapshot; });
    b.on('room:snapshot', snapshot => { latestB = snapshot; });
    await Promise.all([a,b].map(socket => new Promise<void>((resolve,reject) => {
      socket.once('connect', resolve); socket.once('connect_error', reject);
    })));
    const created = await emitAck(a,'room:create',{actionId:crypto.randomUUID(),nickname:'Mây',visibility:'public'});
    expect(created.ok).toBe(true); expect(created.credentials).toBeTruthy();
    const credentials = created.credentials!;
    latestA = created.snapshot;
    const joined = await emitAck(b,'room:join',{actionId:crypto.randomUUID(),code:credentials.roomCode,nickname:'Khoa'});
    expect(joined.ok).toBe(true); expect(joined.snapshot.players).toHaveLength(2);
    latestB = joined.snapshot;

    const ready = await emitAck(b,'room:ready',action(credentials.roomId,joined.snapshot.revision,{ready:true}));
    expect(ready.ok).toBe(true);
    const started = await emitAck(a,'room:start',action(credentials.roomId,ready.snapshot.revision));
    expect(started.ok).toBe(true); expect(started.snapshot.phase).toBe('playing');

    latestA = started.snapshot;
    const snapshotB = await waitForSnapshot(b, () => latestB, started.snapshot.revision);
    expect(snapshotB.phase).toBe('playing');
    const handA = started.snapshot.game.hand as Array<{id:string}>;
    const handB = snapshotB.game.hand as Array<{id:string}>;
    expect(handB).toHaveLength(1);
    expect(handA.map(c=>c.id)).not.toEqual(expect.arrayContaining(handB.map(c=>c.id)));
    const gameViewA = started.snapshot.game;
    expect(gameViewA.hand.length).toBeGreaterThanOrEqual(7);
    expect(gameViewA).not.toHaveProperty('drawPile');

    const currentPlayerId = gameViewA.currentPlayerId;
    const actor = currentPlayerId === credentials.playerId ? a : b;
    const effectEventsA: any[] = []; const effectEventsB: any[] = [];
    a.on('game:effect', (event) => effectEventsA.push(event)); b.on('game:effect', (event) => effectEventsB.push(event));
    const gameActionId = crypto.randomUUID();
    const payload = { ...action(credentials.roomId,started.snapshot.revision), actionId:gameActionId, gameId:started.snapshot.game.gameId, type:'play', cardId:'fixture-a-red-5' };
    const first = await emitAck(actor,'game:action',payload);
    expect(first.ok).toBe(true);
    const countAfter = active.rooms.getRoom(credentials.roomId).game!.discardPile.length;
    const repeated = await emitAck(actor,'game:action',payload);
    expect(repeated.ok).toBe(true);
    expect(active.rooms.getRoom(credentials.roomId).game!.discardPile.length).toBe(countAfter);
    expect(repeated.snapshot!.revision).toBe(first.snapshot!.revision);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(effectEventsA).toHaveLength(1); expect(effectEventsB).toHaveLength(1);
    expect(effectEventsA[0]).toMatchObject({ roomId: credentials.roomId, gameId: gameViewA.gameId, actionType: 'play', actorId: currentPlayerId, card: { type: 'number', value: 5 }, gameRevision: 1 });
    expect(effectEventsB[0]).not.toHaveProperty('drawPile'); expect(effectEventsB[0]).not.toHaveProperty('hand');
    if (currentPlayerId === credentials.playerId) latestA = first.snapshot; else latestB = first.snapshot;
    const other = actor === a ? b : a;
    const currentRev = first.snapshot!.revision;
    await waitForSnapshot(other, () => other === a ? latestA : latestB, currentRev);

    let finished = false;
    for (let step = 0; step < 10; step++) {
      const roomSnapshot = latestA.revision >= latestB.revision ? latestA : latestB;
      const game = roomSnapshot.game;
      if (roomSnapshot.phase === 'finished') { finished = true; break; }
      const currentId = game.currentPlayerId as string;
      const isA = currentId === credentials.playerId;
      const socket = isA ? a : b;
      const ownSnapshot = isA ? latestA : latestB;
      const ownGame = ownSnapshot.game;
      let intent: Record<string, unknown>;
      if (ownGame.phase === 'penalty') intent = { type: 'acceptPenalty' };
      else if (ownGame.phase === 'chooseColor') intent = { type: 'chooseColor', color: 'red' };
      else if (ownGame.phase === 'drawn') {
        const drawn = ownGame.hand.find((card: any) => card.id === ownGame.drawnCardId);
        intent = drawn ? { type: 'play', cardId: drawn.id, ...(['wild','wildDrawFour'].includes(drawn.type) ? { color: ownGame.currentColor } : {}), declareUno: ownGame.hand.length === 2 } : { type: 'keep' };
      } else {
        const playable = ownGame.hand.find((card: any) => legal(card, ownGame));
        intent = playable ? { type: 'play', cardId: playable.id, ...(['wild','wildDrawFour'].includes(playable.type) ? { color: ownGame.currentColor } : {}), declareUno: ownGame.hand.length === 2 } : { type: 'draw' };
      }
      const moved = await emitAck(socket,'game:action',action(credentials.roomId,ownSnapshot.revision,{...intent,gameId:ownGame.gameId}));
      expect(moved.ok, moved.message).toBe(true);
      if (isA) latestA = moved.snapshot; else latestB = moved.snapshot;
      await waitForSnapshot(isA ? b : a, () => isA ? latestB : latestA, moved.snapshot!.revision);
    }
    expect(finished, JSON.stringify({ a: latestA?.game?.players?.map((player: any) => player.cardCount), b: latestB?.game?.players?.map((player: any) => player.cardCount), phase: latestA?.game?.phase, roomPhase: latestA?.phase })).toBe(true);
    expect(latestA.phase).toBe('finished');
    expect(latestB.phase).toBe('finished');
    expect(latestA.game.winnerId || latestB.game.winnerId || latestA.game.finishReason).toBeTruthy();
    const left = await emitAck(a,'room:leave',action(credentials.roomId,0));
    expect(left.ok).toBe(true);
    const afterLeave = active.rooms.getRoom(credentials.roomId);
    expect(afterLeave.players.size).toBe(1);
    expect(afterLeave.hostId).toBe(joined.credentials!.playerId);
  }, 10000);
});

function waitForSnapshot(socket: Socket, current: () => any, revision: number) {
  if (current()?.revision >= revision) return Promise.resolve(current());
  return new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => { socket.off('room:snapshot', handler); reject(new Error('Snapshot timeout at revision ' + revision)); }, 4000);
    const handler = (snapshot: any) => {
      if (snapshot.revision < revision) return;
      clearTimeout(timer); socket.off('room:snapshot', handler); resolve(snapshot);
    };
    socket.on('room:snapshot', handler);
  });
}


class PenaltyFixtureService extends RoomService {
  override start(room: ReturnType<RoomService['getRoom']>, actor: ReturnType<RoomService['getSeat']>) {
    super.start(room, actor);
    const game=room.game!;
    game.players[0]!.hand=[fixtureCard('red5','red',5),{id:'wild4',color:'wild',type:'wildDrawFour'},fixtureCard('blue1','blue',1)];
    game.players[1]!.hand=[fixtureCard('blue9','blue',9),{id:'red2',color:'red',type:'drawTwo'},{id:'green2',color:'green',type:'drawTwo'}];
    game.discardPile=[fixtureCard('blue5','blue',5)];game.drawPile=Array.from({length:20},(_,i)=>fixtureCard('draw'+i,'green',i%10));
    game.currentColor='blue';game.currentPlayerId=game.players[0]!.id;game.direction=1;game.phase='turn';game.pendingPenalty=null;game.unoWindow=null;game.drawnCardId=null;
  }
}

it('hai socket xác thực màu, cộng/nhận phạt, reload host, rematch và báo đóng phòng',async()=>{
  active=createRealtimeServer({serveWeb:false,roomService:new PenaltyFixtureService()});
  await new Promise<void>(resolve=>active!.http.listen(0,'127.0.0.1',resolve));
  const addr=active.http.address();if(!addr||typeof addr==='string')throw new Error('Không có cổng');
  const url='http://127.0.0.1:'+addr.port;
  const open=async()=>{const s=connect(url,{forceNew:true,transports:['websocket'],reconnection:false});clients.push(s);await new Promise<void>((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject)});return s};
  let a=await open();const b=await open();
  const created=await emitAck(a,'room:create',{actionId:crypto.randomUUID(),nickname:'Chủ',visibility:'private'});expect(created.ok).toBe(true);
  const cred=created.credentials!,roomId=cred.roomId;
  const joined=await emitAck(b,'room:join',{actionId:crypto.randomUUID(),nickname:'Khách',code:cred.roomCode});expect(joined.ok).toBe(true);
  const ready=await emitAck(b,'room:ready',action(roomId,joined.snapshot.revision,{ready:true}));
  const started=await emitAck(a,'room:start',action(roomId,ready.snapshot.revision));expect(started.ok).toBe(true);
  const gameId=started.snapshot.game.gameId;
  a.disconnect();a=await open();
  const resumed=await emitAck(a,'session:resume',{roomId,playerId:cred.playerId,token:cred.token});expect(resumed.ok).toBe(true);expect(resumed.snapshot.game.gameId).toBe(gameId);expect(resumed.snapshot.players).toHaveLength(2);expect(resumed.snapshot.paused).toBe(false);
  let revision=resumed.snapshot.revision;
  const move=async(s:Socket,intent:Record<string,unknown>)=>{const r=await emitAck(s,'game:action',action(roomId,revision,{gameId,...intent}));if(r.ok)revision=r.snapshot!.revision;return r};
  const first=await move(a,{type:'play',cardId:'red5'});expect(first.ok).toBe(true);expect(first.snapshot!.game.currentColor).toBe('red');
  const bad=await move(b,{type:'play',cardId:'blue9'});expect(bad.code).toBe('CARD_DOES_NOT_MATCH');expect(active.rooms.getRoom(roomId).revision).toBe(revision);
  const two=await move(b,{type:'play',cardId:'red2'});expect(two.ok).toBe(true);expect(two.snapshot!.game.pendingPenalty.total).toBe(2);
  const four=await move(a,{type:'play',cardId:'wild4',color:'blue',declareUno:true});expect(four.ok).toBe(true);expect(four.snapshot!.game.pendingPenalty.total).toBe(6);expect(four.snapshot!.game.currentColor).toBe('blue');
  expect((await move(b,{type:'play',cardId:'green2'})).ok).toBe(false);
  expect((await move(b,{type:'resolveWildFour',decision:'challenge'})).code).toBe('INVALID_PAYLOAD');
  expect((await emitAck(b,'game:action',action(roomId,revision-1,{gameId,type:'acceptPenalty'}))).code).toBe('STALE_REVISION');
  const payload=action(roomId,revision,{gameId,type:'acceptPenalty'});
  const accepted=await emitAck(b,'game:action',payload);expect(accepted.ok).toBe(true);expect(accepted.snapshot.game.hand).toHaveLength(8);revision=accepted.snapshot.revision;
  expect(accepted.snapshot.game).not.toHaveProperty('drawPile');expect(accepted.snapshot.game.players[0]).not.toHaveProperty('hand');
  const repeated=await emitAck(b,'game:action',payload);expect(repeated.snapshot!.revision).toBe(revision);expect(repeated.snapshot!.game.hand).toHaveLength(8);
  // Complete fixture round, then verify rematch has fresh game identity and no pending penalty.
  expect((await move(a,{type:'play',cardId:'blue1'})).snapshot!.phase).toBe('finished');
  const rematch=await emitAck(a,'room:rematch',action(roomId,revision));expect(rematch.ok).toBe(true);expect(rematch.snapshot.game).toBeNull();
  const r2=await emitAck(b,'room:ready',action(roomId,rematch.snapshot.revision,{ready:true}));
  const s2=await emitAck(a,'room:start',action(roomId,r2.snapshot.revision));expect(s2.snapshot.game.gameId).not.toBe(gameId);expect(s2.snapshot.game.pendingPenalty).toBeNull();
  expect((await emitAck(a,'game:action',action(roomId,s2.snapshot.revision,{gameId,type:'draw'}))).code).toBe('STALE_GAME');
  const notices=[a,b].map(s=>new Promise<any>(resolve=>s.once('room:closed',resolve)));
  active.rooms.destroyAll();const closed=await Promise.all(notices);expect(closed.every(p=>p.roomId===roomId&&p.reason==='shutdown')).toBe(true);
  const lost=await emitAck(a,'session:resume',{roomId,playerId:cred.playerId,token:cred.token});expect(lost.code).toBe('ROOM_NOT_FOUND');
});

it('hai socket chơi hết một ván shuffle production, bảo toàn 108 lá qua mọi hành động',async()=>{
  active=createRealtimeServer({serveWeb:false,maxEventsPerWindow:5000});
  await new Promise<void>(resolve=>active!.http.listen(0,'127.0.0.1',resolve));const addr=active.http.address();if(!addr||typeof addr==='string')throw new Error('Không có cổng');
  const pair=Array.from({length:2},()=>connect('http://127.0.0.1:'+addr.port,{forceNew:true,transports:['websocket'],reconnection:false}));clients.push(...pair);
  const views:any[]=[];pair.forEach((s,i)=>s.on('room:snapshot',view=>{views[i]=view}));
  await Promise.all(pair.map(s=>new Promise<void>((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject)})));
  const created=await emitAck(pair[0]!,'room:create',{actionId:crypto.randomUUID(),nickname:'Một',visibility:'private'});expect(created.ok).toBe(true);const c=created.credentials!;
  const joined=await emitAck(pair[1]!,'room:join',{actionId:crypto.randomUUID(),nickname:'Hai',code:c.roomCode});expect(joined.ok).toBe(true);views[1]=joined.snapshot;
  const ready=await emitAck(pair[1]!,'room:ready',action(c.roomId,joined.snapshot.revision,{ready:true}));
  const started=await emitAck(pair[0]!,'room:start',action(c.roomId,ready.snapshot.revision));expect(started.ok).toBe(true);views[0]=started.snapshot;
  await waitForSnapshot(pair[1]!,()=>views[1],started.snapshot.revision);
  let steps=0;
  for(;steps<2000;steps++){
    const top=views[0];if(top.phase==='finished')break;
    const i=top.game.currentPlayerId===c.playerId?0:1, own=views[i], g=own.game;
    let intent:Record<string,unknown>;
    if(g.allowedActions.canChooseColor)intent={type:'chooseColor',color:'red'};
    else if(g.allowedActions.canAcceptPenalty)intent={type:'acceptPenalty'};
    else if(g.allowedActions.playableCardIds.length){const card=g.hand.find((v:any)=>v.id===g.allowedActions.playableCardIds[0]);const colors=['red','blue','green','yellow'];const color=colors.sort((a,b)=>g.hand.filter((v:any)=>v.color===b).length-g.hand.filter((v:any)=>v.color===a).length)[0];intent={type:'play',cardId:card.id,declareUno:true,...(card.color==='wild'?{color}:{})};}
    else if(g.allowedActions.canKeep)intent={type:'keep'};
    else intent={type:'draw'};
    const reply=await emitAck(pair[i]!,'game:action',action(c.roomId,own.revision,{gameId:g.gameId,...intent}));expect(reply.ok,reply.message).toBe(true);views[i]=reply.snapshot;
    await waitForSnapshot(pair[1-i]!,()=>views[1-i],reply.snapshot!.revision);
    const state=active.rooms.getRoom(c.roomId).game!;
    const cards=[...state.drawPile,...state.discardPile,...state.players.flatMap(p=>p.hand)];expect(cards).toHaveLength(108);expect(new Set(cards.map(v=>v.id)).size).toBe(108);
    for(const view of views){expect(view.game).not.toHaveProperty('drawPile');expect(view.game.players.every((p:any)=>!('hand'in p))).toBe(true)}
  }
  expect(steps).toBeLessThan(2000);expect(views[0].phase).toBe('finished');expect(views[1].game.winnerId).toBe(views[0].game.winnerId);
  console.log('Production-shuffle Socket.IO round:',steps,'actions, result:',views[0].game.finishReason);
},30000);
