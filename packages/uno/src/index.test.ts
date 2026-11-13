import { describe, expect, it } from 'vitest';
import { applyGameAction, createDeck, createGame, pickDealer, projectGame, type UnoCard, type UnoState } from './index.ts';

function rng(seed = 7) {
  let value = seed;
  return (max: number) => { value = (value * 48271) % 2147483647; return value % max; };
}
function start(count = 3) {
  return createGame({ gameId: 'test-game', players: Array.from({ length: count }, (_, i) => ({ id: 'p' + i, nickname: 'Người ' + i })), randomInt: rng() });
}
function card(id: string, color: UnoCard['color'], type: UnoCard['type'], value?: number): UnoCard {
  return { id, color, type, ...(value === undefined ? {} : { value }) };
}
function rig(hands: UnoCard[][], top: UnoCard, draw: UnoCard[] = [], current = 'p0'): UnoState {
  const state = start(hands.length);
  state.players.forEach((p, i) => { p.hand = hands[i]!; });
  state.discardPile = [top]; state.drawPile = draw; state.currentColor = top.color === 'wild' ? 'red' : top.color;
  state.direction = 1; state.currentPlayerId = current; state.phase = 'turn'; state.drawnCardId = null;
  state.pendingPenalty = null; state.unoWindow = null; state.winnerId = null; state.finishReason = null; state.revision = 0;
  return state;
}
const deterministic = rng(19);

describe('Bộ bài và chia bài UNO BB-UNO-1', () => {
  it('có đúng 108 lá, số lượng theo màu và chức năng', () => {
    const deck = createDeck('d');
    expect(deck).toHaveLength(108);
    expect(new Set(deck.map(c => c.id)).size).toBe(108);
    for (const color of ['red','yellow','green','blue']) {
      expect(deck.filter(c => c.color === color)).toHaveLength(25);
      expect(deck.filter(c => c.color === color && c.type === 'number' && c.value === 0)).toHaveLength(1);
      for (let n=1;n<=9;n++) expect(deck.filter(c => c.color === color && c.value === n)).toHaveLength(2);
    }
    expect(deck.filter(c => c.type === 'wild')).toHaveLength(4);
    expect(deck.filter(c => c.type === 'wildDrawFour')).toHaveLength(4);
  });
  it.each([2,3,4,5,6])('chia đủ 7 lá cho %i người và bảo toàn tổng bộ bài', count => {
    const state = start(count);
    expect(state.players.map(p => p.hand)).toHaveLength(count);
    expect(state.players.every(p => p.hand.length === 7)).toBe(true);
    expect(state.drawPile.length + state.discardPile.length + state.players.reduce((n,p)=>n+p.hand.length,0)).toBe(108);
    expect(state.discardPile).toHaveLength(0);
    expect(state.drawPile).toHaveLength(108 - count * 7);
    expect(state.currentColor).toBeNull();
    expect(state.phase).toBe('turn');
    expect(state.pendingPenalty).toBeNull();
  });
  it('chọn người chia bằng lá rút thực; khi hòa, người hòa rút lại', () => {
    const choices = [17,17,0,0];
    let call = 0;
    const dealer = pickDealer([{id:'p0'},{id:'p1'}],'dealer-test',(max) => choices[call++]! % max);
    expect(dealer).toBe('p1');
  });
  it('bàn rỗng cho người đi đầu đánh bất kỳ lá nào, rồi áp dụng khớp màu/số', () => {
    const state = start(3);
    const actor = state.currentPlayerId;
    const own = state.players.find(p => p.id === actor)!;
    const view = projectGame(state, actor);
    expect(view.topCard).toBeNull();
    expect(view.allowedActions.playableCardIds).toEqual(own.hand.map(c => c.id));
    const other = state.players.find(p => p.id !== actor)!;
    expect(() => applyGameAction(state,other.id,{type:'play',cardId:other.hand[0]!.id},rng(8))).toThrow(/lượt/);
    const first = own.hand[0]!;
    const next = applyGameAction(state,actor,{type:'play',cardId:first.id,...(first.color === 'wild' ? {color:'green' as const} : {})},rng(8));
    expect(projectGame(next,actor).topCard?.id).toBe(first.id);
    expect(next.currentColor).toBe(first.color === 'wild' ? 'green' : first.color);
  });
});

describe('Luật lượt và lá hành động', () => {
  it('từ chối sai lượt mà không đổi trạng thái', () => {
    const s = rig([[card('a','red','number',1)],[card('b','red','number',2)]],card('top','red','number',5));
    const before = JSON.stringify(s);
    expect(() => applyGameAction(s,'p1',{type:'play',cardId:'b'},deterministic)).toThrow(/lượt/);
    expect(JSON.stringify(s)).toBe(before);
  });
  it('Reverse ở ván hai người như Skip, người đánh đi tiếp', () => {
    const s = rig([[card('r','red','reverse'),card('n','blue','number',1)],[card('n2','red','number',2)]],card('top','red','number',5),[], 'p0');
    const next = applyGameAction(s,'p0',{type:'play',cardId:'r'},deterministic);
    expect(next.direction).toBe(-1); expect(next.currentPlayerId).toBe('p0');
  });
  it('Rút hai tạo khoản phạt, không rút tự động', () => {
    const s = rig([[card('a','red','drawTwo'),card('b','blue','number',1)],[card('c','red','drawTwo')],[card('d','green','number',2)]],card('top','red','number',5));
    const next = applyGameAction(s,'p0',{type:'play',cardId:'a'},deterministic);
    expect(next.players[1]!.hand).toHaveLength(1); expect(next.currentPlayerId).toBe('p1'); expect(next.pendingPenalty?.total).toBe(2);
  });
  it('sau rút chỉ có thể đánh lá vừa rút hoặc giữ lượt', () => {
    const s = rig([[card('old','red','number',2)],[card('opp','blue','number',8)]],card('top','red','number',5),[card('new','red','number',7)]);
    const drawn = applyGameAction(s,'p0',{type:'draw'},deterministic);
    expect(drawn.phase).toBe('drawn');
    expect(() => applyGameAction(drawn,'p0',{type:'play',cardId:'old'},deterministic)).toThrow(/vừa rút/);
    const played = applyGameAction(drawn,'p0',{type:'play',cardId:'new'},deterministic);
    expect(played.discardPile.at(-1)?.id).toBe('new');
  });
});

describe('Wild, UNO và projection riêng tư', () => {
  it('lá +4 vừa rút đánh được dù giữ màu hiện hành, không lộ bài đối thủ', () => {
    const s = rig([[card('same','red','number',4)],[card('opp','blue','number',8)]],card('top','red','number',5),[card('w4','wild','wildDrawFour')]);
    const drawn = applyGameAction(s,'p0',{type:'draw'},deterministic);
    const attack = applyGameAction(drawn,'p0',{type:'play',cardId:'w4',color:'blue'},deterministic);
    expect(attack.phase).toBe('penalty'); expect(attack.pendingPenalty?.total).toBe(4);
    const view = projectGame(attack,'p1'); expect(view).not.toHaveProperty('drawPile'); expect(view).not.toHaveProperty('players.0.hand'); expect(view).not.toHaveProperty('pendingWildFour');
  });
  it('mở và giải quyết cửa sổ UNO; bắt lỗi rút hai lá', () => {
    const s = rig([[card('play','red','number',8),card('last','blue','number',1)],[card('x','blue','number',4)]],card('top','red','number',2),[card('p','green','number',1),card('q','yellow','number',2)]);
    const played = applyGameAction(s,'p0',{type:'play',cardId:'play'},deterministic);
    expect(played.unoWindow?.playerId).toBe('p0');
    const caught = applyGameAction(played,'p1',{type:'catchUno',targetPlayerId:'p0'},deterministic);
    expect(caught.players[0]!.hand).toHaveLength(3); expect(caught.unoWindow).toBeNull();
  });
  it('sau Reverse còn một lá, cửa sổ bắt UNO theo hướng mới', () => {
    const s = rig([[card('reverse','red','reverse'),card('last','blue','number',1)],[card('p1','blue','number',4)],[card('p2','green','number',5)]],card('top','red','number',2),[card('d1','yellow','number',3),card('d2','green','number',6)]);
    const played = applyGameAction(s,'p0',{type:'play',cardId:'reverse'},deterministic);
    expect(played.currentPlayerId).toBe('p2');
    expect(played.unoWindow?.nextPlayerId).toBe('p2');
    const caught = applyGameAction(played,'p2',{type:'catchUno',targetPlayerId:'p0'},deterministic);
    expect(caught.players[0]!.hand).toHaveLength(3);
  });
  it('projection hiển thị số lá đối thủ nhưng không lộ tay bài hoặc chồng rút', () => {
    const s = start(3); const view = projectGame(s,'p0') as Record<string,unknown>;
    expect((view.hand as UnoCard[]).length).toBeGreaterThanOrEqual(7); expect(view).not.toHaveProperty('drawPile');
    expect(view.players).toEqual(expect.arrayContaining([expect.objectContaining({id:'p1',cardCount:expect.any(Number)})]));
    expect((view.players as Array<{id:string;cardCount:number}>).find((player) => player.id === 'p1')!.cardCount).toBeGreaterThanOrEqual(7);
    expect(JSON.stringify(view)).not.toContain('p1\u0000');
  });
  it('kết thúc khi người chơi hết bài', () => {
    const s = rig([[card('last','red','number',6)],[]],card('top','red','number',5));
    const result = applyGameAction(s,'p0',{type:'play',cardId:'last'},deterministic);
    expect(result.phase).toBe('finished'); expect(result.winnerId).toBe('p0');
  });
});

