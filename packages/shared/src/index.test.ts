import { expect, it } from 'vitest';
import { gameActionSchema, gameEffectSchema, roomClosedSchema } from './index';
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
