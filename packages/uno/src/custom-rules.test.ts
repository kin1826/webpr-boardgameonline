import { describe, expect, it } from 'vitest';
import { applyGameAction, createGame, projectGame, type UnoCard, type UnoState } from './index';
const random = (max: number) => Math.floor(max / 2);
let sequence = 0;
const number = (color: UnoCard['color'], value: number): UnoCard => ({ id: 'n'+sequence++, color, type: 'number', value });
const action = (type: UnoCard['type'], color: UnoCard['color'] = 'red'): UnoCard => ({ id:'a'+sequence++, type, color });
function rig(hands: UnoCard[][]): UnoState {
  return { gameId:'fixture', players:hands.map((hand,i)=>({id:'p'+i,nickname:'P'+i,hand})), drawPile:Array.from({length:40},()=>number('blue',9)), discardPile:[number('red',5)], currentColor:'red',direction:1,currentPlayerId:'p0',dealerId:'p1',phase:'turn',drawnCardId:null,pendingPenalty:null,unoWindow:null,winnerId:null,finishReason:null,revision:0 };
}
const play = (s: UnoState, id: string, c: UnoCard, color?: 'red'|'blue'|'green'|'yellow') => applyGameAction(s,id,{type:'play',cardId:c.id,...(color?{color}:{})},random);

describe('BB-UNO-1 regression màu và lượt',()=>{
  it.each(['number','skip','reverse','drawTwo','wild','wildDrawFour'] as const)('lá đầu %s mở màu và áp dụng chức năng ngay', (type) => {
    const first = type === 'number' ? number('green', 7) : action(type, type === 'wild' || type === 'wildDrawFour' ? 'wild' : 'green');
    const s = rig([[first,number('red',1)],[number('blue',2)],[number('yellow',3)]]);
    s.discardPile = []; s.currentColor = null;
    expect(projectGame(s,'p0').allowedActions.playableCardIds).toContain(first.id);
    const next = play(s,'p0',first,first.color === 'wild' ? 'blue' : undefined);
    expect(next.discardPile.at(-1)?.id).toBe(first.id);
    expect(next.currentColor).toBe(first.color === 'wild' ? 'blue' : 'green');
    expect(next.currentPlayerId).toBe(type === 'skip' || type === 'reverse' ? 'p2' : 'p1');
    expect(next.direction).toBe(type === 'reverse' ? -1 : 1);
    expect(next.pendingPenalty?.total ?? 0).toBe(type === 'drawTwo' ? 2 : type === 'wildDrawFour' ? 4 : 0);
  });
  it('rút rồi giữ ở bàn rỗng nhường quyền mở bàn cho người kế tiếp', () => {
    const s = rig([[number('red',1)],[number('blue',2)]]); s.discardPile=[]; s.currentColor=null;
    const drawn = applyGameAction(s,'p0',{type:'draw'},random);
    expect(drawn.phase).toBe('drawn');
    expect(projectGame(drawn,'p0').allowedActions.playableCardIds).toEqual([drawn.drawnCardId]);
    const kept = applyGameAction(drawn,'p0',{type:'keep'},random);
    expect(kept.currentPlayerId).toBe('p1');
    expect(projectGame(kept,'p1').topCard).toBeNull();
    expect(projectGame(kept,'p1').allowedActions.playableCardIds).toEqual(kept.players[1]!.hand.map(c=>c.id));
  });
  it('đổi màu với số trùng, không dùng màu cũ để cho xanh 9 đánh trên đỏ 5',()=>{
    const red5=number('red',5), green5=number('green',5), blue9=number('blue',9);
    const s=rig([[red5,number('blue',1)],[green5,blue9,number('red',1)]]);
    s.currentColor='blue'; s.discardPile=[number('blue',5)];
    const next=play(s,'p0',red5);
    expect(next.currentColor).toBe('red');
    const before=JSON.stringify(next);
    expect(()=>play(next,'p1',blue9)).toThrow(/khớp/);
    expect(JSON.stringify(next)).toBe(before);
    expect(play(next,'p1',green5).currentColor).toBe('green');
    expect(projectGame(next,'p1').allowedActions.playableCardIds).not.toContain(blue9.id);
  });
  it.each([2,3,4,5,6])('Reverse đúng hướng với %i người',n=>{
    const reverse=action('reverse'); const s=rig(Array.from({length:n},()=>[number('red',1),number('blue',2)]));
    s.currentPlayerId='p1'; s.players[1]!.hand.push(reverse);
    const next=play(s,'p1',reverse); expect(next.direction).toBe(-1); expect(next.currentPlayerId).toBe(n===2?'p1':'p0');
    const r2=action('reverse');next.players.find(p=>p.id===next.currentPlayerId)!.hand.push(r2);
    expect(play(next,next.currentPlayerId,r2).direction).toBe(1);
  });
  it('ký hiệu khác màu cập nhật màu, skip và lượt tự quay lại không để UNO treo',()=>{
    const skip=action('skip','green'); const s=rig([[skip,number('blue',3)],[number('red',1)]]); s.discardPile=[action('skip')];
    const next=play(s,'p0',skip);expect(next.currentColor).toBe('green');expect(next.currentPlayerId).toBe('p0');
    const caught=applyGameAction(next,'p1',{type:'catchUno',targetPlayerId:'p0'},random);expect(caught.players[0]!.hand).toHaveLength(3);
    const moved=applyGameAction(next,'p0',{type:'draw'},random);expect(moved.unoWindow).toBeNull();
  });
});
describe('BB-UNO-1 cộng và nhận phạt',()=>{
  it('2+2+4+4=12; không rút tự động, nhận rồi mất lượt, giữ màu +4 gần nhất',()=>{
    const cards=[action('drawTwo'),action('drawTwo','green'),action('wildDrawFour','wild'),action('wildDrawFour','wild')];
    let s=rig(cards.map(c=>[c,number('blue',1)]));
    for(let i=0;i<4;i++) s=play(s,'p'+i,cards[i]!,i>=2?'yellow':undefined);
    expect(s.pendingPenalty?.total).toBe(12);expect(s.phase).toBe('penalty');expect(s.players.every(p=>p.hand.length===1)).toBe(true);
    expect(()=>applyGameAction(s,'p0',{type:'draw'},random)).toThrow();
    expect(()=>applyGameAction(s,'p0',{type:'keep'},random)).toThrow();
    const next=applyGameAction(s,'p0',{type:'acceptPenalty'},random);expect(next.players[0]!.hand).toHaveLength(13);expect(next.currentPlayerId).toBe('p1');expect(next.currentColor).toBe('yellow');expect(next.pendingPenalty).toBeNull();
    expect(()=>applyGameAction(next,'p0',{type:'acceptPenalty'},random)).toThrow();
  });
  it('sau +4 cấm +2/Wild, +4 tự do dù đang giữ cùng màu, có +4 vẫn nhận được',()=>{
    const four=action('wildDrawFour','wild'),two=action('drawTwo'),wild=action('wild','wild'),four2=action('wildDrawFour','wild');
    const s=rig([[four,number('red',1)],[two,wild,four2]]);const next=play(s,'p0',four,'blue');
    expect(()=>play(next,'p1',two)).toThrow(); expect(()=>play(next,'p1',wild,'red')).toThrow();
    expect(projectGame(next,'p1').allowedActions.playableCardIds).toEqual([four2.id]);
    expect(applyGameAction(next,'p1',{type:'acceptPenalty'},random).players[1]!.hand).toHaveLength(7);
  });
  it.each(['drawTwo','wildDrawFour'] as const)('lá cuối %s trong chuỗi thắng ngay và xóa tổng phạt',type=>{
    const a=action('drawTwo'),b=action(type,type==='drawTwo'?'green':'wild');let s=rig([[a,number('red',1)],[b]]);
    s=play(s,'p0',a);const count=s.players[0]!.hand.length;s=play(s,'p1',b,type==='wildDrawFour'?'blue':undefined);
    expect(s.phase).toBe('finished');expect(s.winnerId).toBe('p1');expect(s.pendingPenalty).toBeNull();
    expect(s.players[0]!.hand).toHaveLength(count);
    expect(projectGame(s,'p0').allowedActions.canAcceptPenalty).toBe(false);
    expect(()=>applyGameAction(s,'p0',{type:'acceptPenalty'},random)).toThrow();
  });
  it.each(['number','skip','reverse','drawTwo','wild','wildDrawFour'] as const)('lá cuối %s thắng ngay',type=>{
    const c=type==='number'?number('red',7):action(type,type==='wild'||type==='wildDrawFour'?'wild':'red');
    const s=rig([[c],[number('blue',1)]]);
    const next=play(s,'p0',c,c.color==='wild'?'green':undefined);
    expect(next.phase).toBe('finished');expect(next.winnerId).toBe('p0');expect(next.players[0]!.hand).toHaveLength(0);
    expect(next.pendingPenalty).toBeNull();expect(next.unoWindow).toBeNull();expect(next.discardPile.at(-1)?.id).toBe(c.id);
    expect(projectGame(next,'p1').allowedActions.playableCardIds).toEqual([]);
  });
  it('màu Wild bắt buộc và đúng enum kể cả khi gọi engine trực tiếp',()=>{
    const w=action('wild','wild');const s=rig([[w],[number('red',2)]]);
    expect(()=>play(s,'p0',w)).toThrow();expect(()=>play(s,'p0',w,'purple' as 'red')).toThrow();
    expect(play(s,'p0',w,'green').currentColor).toBe('green');
  });
  it('recycle giữ top và không mất/thêm lá khi nhận phạt',()=>{
    const a=action('drawTwo');let s=rig([[a,number('red',1)],[number('blue',1)]]);s.drawPile=[];s.discardPile.push(number('red',2),number('red',3));
    s=play(s,'p0',a);const ids=(x:UnoState)=>[...x.drawPile,...x.discardPile,...x.players.flatMap(p=>p.hand)].map(c=>c.id).sort();const before=ids(s);
    const next=applyGameAction(s,'p1',{type:'acceptPenalty'},random);expect(ids(next)).toEqual(before);expect(next.discardPile.at(-1)?.id).toBe(a.id);
  });
  it('lá cuối cộng vẫn thắng ngay dù chồng rút trống',()=>{
    const a=action('drawTwo');const s=rig([[a],[number('blue',1)]]);s.drawPile=[];
    const next=play(s,'p0',a);expect(next.finishReason).toBe('winner');expect(next.winnerId).toBe('p0');expect(next.pendingPenalty).toBeNull();
  });
  it('setup giữ 7 lá và bàn rỗng, không có khoản phạt mở đầu',()=>{
    for(let seed=1;seed<30;seed++){let value=seed;const rng=(max:number)=>{value=(value*48271)%2147483647;return value%max};const s=createGame({gameId:'g'+seed,players:[{id:'p0',nickname:'A'},{id:'p1',nickname:'B'}],randomInt:rng});expect(s.players.every(p=>p.hand.length===7)).toBe(true);expect(s.discardPile).toEqual([]);expect(s.pendingPenalty).toBeNull();expect(s.phase).toBe('turn');}
  });
});
