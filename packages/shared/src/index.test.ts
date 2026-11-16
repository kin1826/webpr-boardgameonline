import { expect, it } from 'vitest';
import { caroSettingsSchema, caroActionSchema, caroPublicGameSchema, gameActionSchema, gameEffectSchema, parseRoomSnapshot, roomClosedSchema } from './index';
const envelope={actionId:'799c5e83-b1f8-44ae-bbbb-22aa8feae5fe',roomId:'room-12345',gameId:'game-12345',expectedRevision:2};
it('game action envelope và intent được xác thực cùng nhau, bỏ challenge cũ',()=>{
  expect(gameActionSchema.safeParse({...envelope,type:'play',cardId:'c',color:'red'}).success).toBe(true);
  expect(gameActionSchema.safeParse({...envelope,type:'acceptPenalty'}).success).toBe(true);
  expect(gameActionSchema.safeParse({...envelope,type:'resolveWildFour',decision:'challenge'}).success).toBe(false);
  expect(gameActionSchema.safeParse({...envelope,type:'play',cardId:'c',color:'purple'}).success).toBe(false);
  expect(gameActionSchema.safeParse({...envelope,type:'acceptPenalty',injected:true}).success).toBe(false);
  const {gameId:_,...old}=envelope;expect(gameActionSchema.safeParse({...old,type:'draw'}).success).toBe(false);
});
it('payload đóng phòng có reason hữu hạn và không cho dữ liệu kín',()=>{
  expect(roomClosedSchema.safeParse({roomId:'room-12345',reason:'expired',message:'Đã hết hạn'}).success).toBe(true);
  expect(roomClosedSchema.safeParse({roomId:'room-12345',reason:'expired',message:'Đã hết hạn',token:'secret'}).success).toBe(false);
});
it('game effect có revision công khai và từ chối dữ liệu tay bài kín',()=>{
  const event={eventId:'game-12345:4',roomId:'room-12345',gameId:'game-12345',revision:9,gameRevision:4,actionType:'play',actorId:'player-a',targetId:'player-b',card:{type:'drawTwo',color:'red'},currentColor:'red',direction:1,penaltyTotal:2};
  expect(gameEffectSchema.safeParse(event).success).toBe(true);
  expect(gameEffectSchema.safeParse({...event,drawnCards:[{id:'secret',color:'blue'}]}).success).toBe(false);
  expect(gameEffectSchema.safeParse({...event,card:{type:'number',color:'red',value:12}}).success).toBe(false);
});
it('Caro chỉ nhận intent place/resign hợp lệ và public snapshot theo kích thước đã khai báo',()=>{
  expect(caroActionSchema.safeParse({...envelope,type:'place',row:14,col:0,turnId:'g:turn:1'}).success).toBe(true);
  expect(caroActionSchema.safeParse({...envelope,type:'place',row:15,col:0,turnId:'g:turn:1'}).success).toBe(true);
  expect(caroActionSchema.safeParse({...envelope,type:'place',row:19,col:0,turnId:'g:turn:1'}).success).toBe(false);
  expect(caroActionSchema.safeParse({...envelope,type:'resign'}).success).toBe(true);
  expect(caroActionSchema.safeParse({...envelope,type:'place',row:1,col:1,turnId:'t',injected:true}).success).toBe(false);
  const game={gameId:'game-12345',revision:0,boardSize:15,winLength:5,players:[{id:'a',nickname:'An',symbol:'X'},{id:'b',nickname:'Bình',symbol:'O'}],board:Array(225).fill(null),phase:'turn',currentPlayerId:'a',turnId:'t',lastMove:null,winningLines:[],deadlineAt:30_000,remainingMs:30_000,serverNow:0,turnDurationMs:30_000,winnerId:null,finishReason:null,notice:null,canPlace:true,canResign:true,yourSymbol:'X',legalCellIndexes:Array.from({length:225},(_,i)=>i)};
  expect(caroPublicGameSchema.safeParse(game).success).toBe(true);
  expect(caroPublicGameSchema.safeParse({...game,board:Array(224).fill(null)}).success).toBe(false);
  expect(caroPublicGameSchema.safeParse({...game,token:'secret'}).success).toBe(false);
  const snapshot={roomId:'room-12345',code:'ABC234',visibility:'private',phase:'playing',revision:4,paused:false,hostId:'a',players:[{id:'a',nickname:'An',avatarId:0,isHost:true,isYou:true,online:true,ready:false},{id:'b',nickname:'Bình',avatarId:1,isHost:false,isYou:false,online:true,ready:true}],minPlayers:2,maxPlayers:2,canStart:false,startReason:'Ván chưa kết thúc.',notice:null,match:null,gameKey:'caro',settings:{gameKey:'caro',turnSeconds:30,targetScore:50,boardSize:15,winLength:5},caroWinLength:5,game};
  expect(parseRoomSnapshot(snapshot)?.gameKey).toBe('caro');
  expect(parseRoomSnapshot({...snapshot,game:{...game,board:Array(224).fill(null)}})).toBeNull();
});

it('chỉ nhận cấu hình thắng 4/5/6, không nhận chuỗi hoặc thuộc tính lạ', () => {
  const { gameId: _gameId, ...roomEnvelope } = envelope;
  for (const winLength of [4, 5, 6]) expect(caroSettingsSchema.safeParse({ ...roomEnvelope, winLength }).success).toBe(true);
  for (const winLength of [3, 7, 4.5, '4', null]) expect(caroSettingsSchema.safeParse({ ...roomEnvelope, winLength }).success).toBe(false);
  expect(caroSettingsSchema.safeParse({ ...roomEnvelope, winLength: 4, injected: true }).success).toBe(false);
});
