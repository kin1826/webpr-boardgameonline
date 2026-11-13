import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type CompositionEvent, type KeyboardEvent as ReactKeyboardEvent, type TouchEvent as ReactTouchEvent, type WheelEvent as ReactWheelEvent } from 'react';
import type { NoituDraftNotice, RoomSnapshot } from '@banban/shared';
import AnimatedWordTiles from './AnimatedWordTiles';
import { canConfirmGiveUp, claimSingleAction, timelineFollowAfterScroll, timelineFollowAfterSubmit, type GiveUpTarget } from './interaction-state';
import { activeTurnRowKey, type RejectionPresentation } from './word-tiles';

type ActionReply = { ok: boolean; message?: string };
type Props = {
  snapshot: Extract<RoomSnapshot, { gameKey: 'noitu' }>;
  playerId: string;
  connected: boolean;
  busy: boolean;
  draft: NoituDraftNotice | null;
  rejectionEvent: RejectionPresentation | null;
  onRejectionAnimationDone: (id: number) => void;
  onAction: (intent: Record<string, unknown>) => Promise<ActionReply>;
  onDraft: (value: { gameId: string; turnId: string; sequence: number; suffix: string }) => void;
  onLeave: () => void;
  onRules: () => void;
  onRematch: () => void;
};

export default function NoituTable({ snapshot, playerId, connected, busy, draft, rejectionEvent, onRejectionAnimationDone, onAction, onDraft, onLeave, onRules, onRematch }: Props) {
  const game = snapshot.game;
  const [suffix, setSuffix] = useState('');
  const [formError, setFormError] = useState('');
  const [composing, setComposing] = useState(false);
  const [clockNow, setClockNow] = useState(Date.now());
  const [sending, setSending] = useState(false);
  const [followLatest, setFollowLatest] = useState(true);
  const [giveUpTarget, setGiveUpTarget] = useState<GiveUpTarget | null>(null);
  const [giveUpPending, setGiveUpPending] = useState(false);
  const [giveUpError, setGiveUpError] = useState('');
  const sequenceRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timelineRef = useRef<HTMLElement>(null);
  const onDraftRef = useRef(onDraft);
  const onActionRef = useRef(onAction);
  const onRejectionDoneRef = useRef(onRejectionAnimationDone);
  const rejectionEventRef = useRef(rejectionEvent);
  const rejectionTimerRef = useRef<number | null>(null);
  const finishedRejectionsRef = useRef(new Set<number>());
  const clearedRejectionRef = useRef<number | null>(null);
  const followLatestRef = useRef(true);
  const scrollTopRef = useRef(0);
  const scrollIntentRef = useRef<'up' | 'down' | null>(null);
  const touchYRef = useRef<number | null>(null);
  const wheelIntentAtRef = useRef(0);
  const scrollFrameRef = useRef<number | null>(null);
  const giveUpRequestLockRef = useRef(false);
  const giveUpTriggerRef = useRef<HTMLButtonElement>(null);
  const giveUpDialogRef = useRef<HTMLElement>(null);
  const giveUpContinueRef = useRef<HTMLButtonElement>(null);
  const giveUpDialogWasOpenRef = useRef(false);
  onDraftRef.current = onDraft;
  onActionRef.current = onAction;
  onRejectionDoneRef.current = onRejectionAnimationDone;
  rejectionEventRef.current = rejectionEvent;

  const setFollowLatestValue = useCallback((value: boolean) => {
    followLatestRef.current = value;
    setFollowLatest(value);
  }, []);

  const scrollTimelineToBottom = useCallback(() => {
    const node = timelineRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
    scrollTopRef.current = node.scrollTop;
  }, []);

  const scheduleTimelineFollow = useCallback((force = false) => {
    if (force) setFollowLatestValue(true);
    if (!followLatestRef.current || scrollFrameRef.current !== null) return;
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      if (followLatestRef.current) scrollTimelineToBottom();
    });
  }, [scrollTimelineToBottom, setFollowLatestValue]);

  const finishRejection = useCallback((id: number) => {
    if (finishedRejectionsRef.current.has(id)) return;
    finishedRejectionsRef.current.add(id);
    if (finishedRejectionsRef.current.size > 64) finishedRejectionsRef.current.delete(finishedRejectionsRef.current.values().next().value!);
    onRejectionDoneRef.current(id);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    setSuffix(''); setFormError(''); setSending(false); sequenceRef.current = 0;
  }, [game?.gameId, game?.turnId]);
  useEffect(() => {
    if (!game?.proposal?.id) return;
    setSuffix(''); setFormError(''); setSending(false);
  }, [game?.proposal?.id]);
  useLayoutEffect(() => {
    if (!rejectionEvent || clearedRejectionRef.current === rejectionEvent.id || rejectionEvent.gameId !== game?.gameId || rejectionEvent.turnId !== game?.turnId || game?.phase !== 'turn') return;
    clearedRejectionRef.current = rejectionEvent.id;
    setSuffix(''); setFormError(''); setSending(false);
  }, [rejectionEvent?.id, game?.gameId, game?.turnId, game?.phase]);

  useEffect(() => {
    if (!rejectionEvent) return;
    const valid = rejectionEvent.gameId === game?.gameId && rejectionEvent.turnId === game?.turnId && game?.phase === 'turn' && snapshot.phase === 'playing' && !snapshot.paused && connected;
    if (!valid || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finishRejection(rejectionEvent.id);
      return;
    }
    const timer = window.setTimeout(() => {
      if (rejectionTimerRef.current === timer) rejectionTimerRef.current = null;
      finishRejection(rejectionEvent.id);
    }, 450);
    rejectionTimerRef.current = timer;
    return () => {
      window.clearTimeout(timer);
      if (rejectionTimerRef.current === timer) rejectionTimerRef.current = null;
    };
  }, [rejectionEvent?.id, game?.gameId, game?.turnId, game?.phase, snapshot.phase, snapshot.paused, connected, finishRejection]);
  useEffect(() => () => {
    if (rejectionTimerRef.current !== null) window.clearTimeout(rejectionTimerRef.current);
    if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const clearPresentation = () => {
      if (!media.matches) return;
      if (rejectionTimerRef.current !== null) window.clearTimeout(rejectionTimerRef.current);
      rejectionTimerRef.current = null;
      const current = rejectionEventRef.current;
      if (current) finishRejection(current.id);
    };
    media.addEventListener('change', clearPresentation);
    return () => media.removeEventListener('change', clearPresentation);
  }, [finishRejection]);

  const canDraft = Boolean(game && snapshot.phase === 'playing' && game.phase === 'turn' && game.currentPlayerId === playerId && connected && !snapshot.paused);
  useEffect(() => {
    if (!game || !canDraft || composing) return;
    const timer = window.setTimeout(() => {
      sequenceRef.current += 1;
      onDraftRef.current({ gameId: game.gameId, turnId: game.turnId, sequence: sequenceRef.current, suffix });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [canDraft, composing, game?.gameId, game?.turnId, suffix]);

  useEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline) return;
    const list = timeline.querySelector('.noitu-message-list');
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => scheduleTimelineFollow());
    observer?.observe(timeline);
    if (list) observer?.observe(list);
    const viewport = window.visualViewport;
    const onViewportChange = () => scheduleTimelineFollow();
    window.addEventListener('resize', onViewportChange, { passive: true });
    viewport?.addEventListener('resize', onViewportChange, { passive: true });
    viewport?.addEventListener('scroll', onViewportChange, { passive: true });
    scheduleTimelineFollow();
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', onViewportChange);
      viewport?.removeEventListener('resize', onViewportChange);
      viewport?.removeEventListener('scroll', onViewportChange);
    };
  }, [scheduleTimelineFollow]);
  useEffect(() => {
    scheduleTimelineFollow();
  }, [game?.historyCount, game?.proposal?.id, game?.turnId, game?.phase, suffix, draft?.sequence, rejectionEvent?.id, scheduleTimelineFollow]);
  useEffect(() => {
    if (rejectionEvent && rejectionEvent.gameId === game?.gameId && rejectionEvent.turnId === game?.turnId && game?.phase === 'turn' && game?.currentPlayerId === playerId && connected && !snapshot.paused) {
      scheduleTimelineFollow(true);
      const frame = window.requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
      return () => window.cancelAnimationFrame(frame);
    }
    return undefined;
  }, [rejectionEvent?.id, game?.gameId, game?.turnId, game?.phase, game?.currentPlayerId, playerId, connected, snapshot.paused, scheduleTimelineFollow]);

  useEffect(() => {
    if (!giveUpTarget) return;
    const valid = game && canConfirmGiveUp(giveUpTarget, {
      gameId: game.gameId, turnId: game.turnId, roomPhase: snapshot.phase, gamePhase: game.phase,
      canGiveUp: game.canGiveUp, connected, paused: snapshot.paused,
    });
    if (!valid) {
      setGiveUpTarget(null);
      setGiveUpError('');
    }
  }, [giveUpTarget?.gameId, giveUpTarget?.turnId, game?.gameId, game?.turnId, game?.phase, game?.canGiveUp, snapshot.phase, snapshot.paused, connected]);
  useEffect(() => {
    if (giveUpTarget) {
      giveUpDialogWasOpenRef.current = true;
      const frame = window.requestAnimationFrame(() => giveUpContinueRef.current?.focus());
      return () => window.cancelAnimationFrame(frame);
    }
    if (giveUpDialogWasOpenRef.current) {
      giveUpDialogWasOpenRef.current = false;
      const frame = window.requestAnimationFrame(() => {
        const trigger = giveUpTriggerRef.current;
        if (trigger?.isConnected && !trigger.disabled) trigger.focus();
      });
      return () => window.cancelAnimationFrame(frame);
    }
    return undefined;
  }, [giveUpTarget]);
  useEffect(() => {
    if (!giveUpPending) return;
    const frame = window.requestAnimationFrame(() => giveUpDialogRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [giveUpPending]);

  if (!game) return <div className="page subpage"><p>Đang tải ván Nối từ…</p></div>;
  const activeGame = game;
  const player = activeGame.players.find((item) => item.id === playerId);
  const current = activeGame.players.find((item) => item.id === activeGame.currentPlayerId);
  const proposal = activeGame.proposal;
  const activeRejection = rejectionEvent?.gameId === activeGame.gameId && rejectionEvent.turnId === activeGame.turnId && activeGame.phase === 'turn' && !proposal ? rejectionEvent : null;
  const deadline = proposal?.deadlineAt ?? activeGame.deadlineAt;
  const remaining = deadline !== null ? Math.max(0, deadline - clockNow) : proposal?.remainingMs ?? activeGame.remainingMs;
  const seconds = remaining === null ? null : Math.max(0, Math.ceil(remaining / 1000));
  const isMyTurn = activeGame.currentPlayerId === playerId && activeGame.phase === 'turn';
  const mayGiveUp = activeGame.canGiveUp && !busy && connected && !snapshot.paused;
  const playerSummary = new Map(snapshot.players.map((member) => [member.id, member]));
  const activeCount = activeGame.players.filter((item) => item.status === 'active').length;
  const activeDraftSuffix = draft && draft.gameId === activeGame.gameId && draft.turnId === activeGame.turnId && draft.playerId === activeGame.currentPlayerId ? draft.suffix : '';
  const liveSuffix = activeGame.phase === 'voting' ? proposal?.word.slice(activeGame.requiredSyllable.length).trimStart() ?? '' : isMyTurn ? suffix : activeDraftSuffix;
  const activeWord = `${activeGame.requiredSyllable}${liveSuffix ? ` ${liveSuffix}` : ''}`;

  function latestGiveUpEligibility() {
    return {
      gameId: activeGame.gameId, turnId: activeGame.turnId, roomPhase: snapshot.phase, gamePhase: activeGame.phase,
      canGiveUp: activeGame.canGiveUp, connected, paused: snapshot.paused,
    };
  }

  function openGiveUpDialog() {
    if (!mayGiveUp || giveUpRequestLockRef.current) return;
    setGiveUpError('');
    setGiveUpTarget({ gameId: activeGame.gameId, turnId: activeGame.turnId });
  }

  function dismissGiveUpDialog() {
    if (giveUpPending) return;
    setGiveUpError('');
    setGiveUpTarget(null);
  }

  function handleGiveUpDialogKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      dismissGiveUpDialog();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter((element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) { event.preventDefault(); event.currentTarget.focus(); return; }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  async function confirmGiveUp() {
    const target = giveUpTarget;
    if (!target || !canConfirmGiveUp(target, latestGiveUpEligibility()) || busy || giveUpPending || !claimSingleAction(giveUpRequestLockRef)) return;
    setGiveUpPending(true);
    setGiveUpError('');
    try {
      const result = await onActionRef.current({ type: 'giveUp', turnId: target.turnId });
      if (result.ok) setGiveUpTarget(null);
      else if (canConfirmGiveUp(target, latestGiveUpEligibility())) setGiveUpError(result.message ?? 'Chưa thể chịu thua lúc này. Hãy thử lại.');
    } catch (error) {
      if (canConfirmGiveUp(target, latestGiveUpEligibility())) setGiveUpError(error instanceof Error ? error.message : 'Chưa thể chịu thua lúc này. Hãy thử lại.');
    } finally {
      giveUpRequestLockRef.current = false;
      setGiveUpPending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (composing || !activeGame.canSubmit || busy || sending || !connected || snapshot.paused) return;
    if (!suffix.trim()) { setFormError('Nhập tiếng thứ hai để tạo thành một từ hai tiếng.'); inputRef.current?.focus(); return; }
    setSending(true); setFormError('');
    try {
      const result = await onAction({ type: 'submit', suffix, turnId: activeGame.turnId });
      if (!result.ok) { setFormError(result.message ?? 'Chưa gửi được từ. Hãy thử lại.'); inputRef.current?.focus(); }
      else {
        setFollowLatestValue(timelineFollowAfterSubmit(followLatestRef.current, true));
        scheduleTimelineFollow(true);
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Chưa gửi được từ. Hãy thử lại.');
      inputRef.current?.focus();
    } finally { setSending(false); }
  }
  async function vote(decision: 'accept' | 'reject') {
    if (!proposal || !proposal.canVote || busy || !connected || snapshot.paused) return;
    await onAction({ type: 'vote', turnId: activeGame.turnId, proposalId: proposal.id, decision });
  }
  function handleTimelineScroll() {
    const node = timelineRef.current;
    if (!node) return;
    const movedUp = node.scrollTop < scrollTopRef.current - 1;
    const intentionalUp = movedUp && (scrollIntentRef.current === 'up' || wheelIntentAtRef.current > 0 && performance.now() - wheelIntentAtRef.current < 180);
    const atBottom = node.scrollHeight - node.scrollTop - node.clientHeight <= 64;
    setFollowLatestValue(timelineFollowAfterScroll(followLatestRef.current, atBottom, intentionalUp));
    scrollTopRef.current = node.scrollTop;
    if (intentionalUp) scrollIntentRef.current = null;
  }
  function handleTimelineWheel(event: ReactWheelEvent<HTMLElement>) {
    if (event.deltaY < 0) { scrollIntentRef.current = 'up'; wheelIntentAtRef.current = performance.now(); }
    else if (event.deltaY > 0) { scrollIntentRef.current = 'down'; wheelIntentAtRef.current = performance.now(); }
  }
  function handleTimelineTouchStart(event: ReactTouchEvent<HTMLElement>) {
    touchYRef.current = event.touches[0]?.clientY ?? null;
    scrollIntentRef.current = null;
  }
  function handleTimelineTouchMove(event: ReactTouchEvent<HTMLElement>) {
    const y = event.touches[0]?.clientY;
    if (y === undefined || touchYRef.current === null) return;
    const delta = y - touchYRef.current;
    if (delta > 4) { scrollIntentRef.current = 'up'; setFollowLatestValue(false); }
    else if (delta < -4) scrollIntentRef.current = 'down';
    touchYRef.current = y;
  }
  function handleTimelineTouchEnd() { touchYRef.current = null; scrollIntentRef.current = null; }
  function handleTimelineKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (['ArrowUp', 'PageUp', 'Home'].includes(event.key)) scrollIntentRef.current = 'up';
    else if (['ArrowDown', 'PageDown', 'End'].includes(event.key)) scrollIntentRef.current = 'down';
  }
  function jumpToLatest() { setFollowLatestValue(true); scheduleTimelineFollow(true); }
  function compositionEnd(event: CompositionEvent<HTMLInputElement>) { setComposing(false); setSuffix(event.currentTarget.value); }

  return <div className="table-page noitu-page noitu-chat-page">
    <div className="table-topline noitu-topline">
      <button className="back-link" type="button" onClick={onLeave}>← <span>Rời bàn</span></button>
      <div className="table-room-meta"><span className="live-indicator" />NỐI TỪ · PHÒNG {snapshot.code}<i /><button type="button" onClick={onRules}>Luật chơi ›</button></div>
      <span className={`connection-state ${connected ? 'is-connected' : 'is-offline'}`}>{connected ? 'Đã kết nối' : 'Đang nối lại'}</span>
    </div>
    {snapshot.notice && <div className="room-notice" role="status">{snapshot.notice}</div>}
    {(!connected || snapshot.paused) && <div className="noitu-reconnect" role="status"><b>{snapshot.paused ? 'Ván tạm dừng' : 'Đang kết nối lại'}</b><span>{snapshot.paused ? `Chờ ${snapshot.players.filter((item) => !item.online).map((item) => item.nickname).join(', ') || 'người chơi'} kết nối lại. Thời gian lượt đang được giữ.` : 'Bàn sẽ đồng bộ lại khi kết nối được khôi phục.'}</span></div>}

    <main className="noitu-chat-board" aria-label="Bàn chơi Nối từ">
      <section className="noitu-player-strip" aria-label="Người chơi">
        {activeGame.players.map((member, index) => {
          const seat = playerSummary.get(member.id);
          return <div key={member.id} className={`noitu-player${member.id === activeGame.currentPlayerId ? ' is-current' : ''}${member.status === 'eliminated' ? ' is-eliminated' : ''}${seat && !seat.online ? ' is-offline' : ''}`}>
            <span className={`avatar avatar-${index % 4}`}>{member.nickname.slice(0, 1).toUpperCase()}</span>
            <span className="noitu-player-copy"><strong>{member.nickname}{member.id === playerId ? ' · Bạn' : ''}</strong><small>{member.status === 'eliminated' ? 'Đã bị loại' : member.id === activeGame.currentPlayerId ? 'Đang tới lượt' : seat?.online ? 'Đang chơi' : 'Mất kết nối'}</small></span>
          </div>;
        })}
      </section>

      <section className="noitu-timeline" aria-label="Diễn biến ván chơi" ref={timelineRef} tabIndex={0} onScroll={handleTimelineScroll} onWheel={handleTimelineWheel} onTouchStart={handleTimelineTouchStart} onTouchMove={handleTimelineTouchMove} onTouchEnd={handleTimelineTouchEnd} onTouchCancel={handleTimelineTouchEnd} onKeyDown={handleTimelineKeyDown}>
        <ol className="noitu-message-list">
          {activeGame.history.map((item, index) => {
            const own = item.playerId === playerId;
            return <li key={`${item.kind}-${item.playerId ?? 'seed'}-${item.word}-${index}`} className={`noitu-message${own ? ' is-own' : ''}${item.kind === 'seed' ? ' is-seed' : ''}`}>
              {!own && item.kind !== 'seed' && <span className={`avatar avatar-${activeGame.players.findIndex((p) => p.id === item.playerId) % 4}`}>{item.nickname.slice(0, 1).toUpperCase()}</span>}
              <div className="noitu-message-body">
                <span className="noitu-message-author">{item.kind === 'seed' ? 'Từ mở đầu' : `${item.nickname}${own ? ' · Bạn' : ''}`}</span>
                <div className="noitu-message-bubble"><AnimatedWordTiles word={item.word} label={item.word} highlightLast animateChanges={false} /></div>
                {item.acceptedByGroup && <span className="noitu-message-note">Được nhóm chấp nhận</span>}
              </div>
              {own && <span className="avatar avatar-own">{item.nickname.slice(0, 1).toUpperCase()}</span>}
            </li>;
          })}
          {(activeGame.phase === 'turn' || activeGame.phase === 'voting') && <li key={activeTurnRowKey(activeGame.gameId, activeGame.turnId)} data-active-turn={activeGame.turnId} className={`noitu-message noitu-active-message${proposal ? ' is-proposal' : ' is-pending'}${activeGame.currentPlayerId === playerId ? ' is-own' : ''}`}>
            {activeGame.currentPlayerId !== playerId && <span className="avatar avatar-pending">{current?.nickname.slice(0, 1).toUpperCase() ?? '?'}</span>}
            <div className="noitu-message-body">
              <span className="noitu-message-author">{current?.nickname ?? 'Người chơi'}{activeGame.currentPlayerId === playerId ? ' · Bạn' : ''} · {proposal ? 'Chờ biểu quyết' : isMyTurn ? (suffix ? 'Đang nhập' : 'Tới lượt bạn') : (activeDraftSuffix ? 'Đang nhập' : 'Đang nghĩ')} · {seconds ?? 0} giây</span>
              <div className="noitu-message-bubble">
                <AnimatedWordTiles word={activeWord} label={proposal ? `Đang chờ duyệt: ${proposal.word}` : `Tiếng cần nối ${activeGame.requiredSyllable}${liveSuffix ? `, đang ghép ${liveSuffix}` : ''}`} singleLine animateChanges={!proposal && !activeRejection} rejection={activeRejection} keepRejectionFragments={Boolean(activeRejection && connected && !snapshot.paused && snapshot.phase === 'playing')} />
              </div>
              <span className="noitu-message-note">{proposal ? `${proposal.acceptCount} chấp nhận · ${proposal.rejectCount} bác bỏ · còn ${seconds ?? 0} giây` : <>Tiếng cần nối: <b>{activeGame.requiredSyllable}</b></>}</span>
            </div>
            {activeGame.currentPlayerId === playerId && <span className="avatar avatar-own">{player?.nickname.slice(0, 1).toUpperCase() ?? 'B'}</span>}
          </li>}
          {activeGame.phase === 'finished' && <li className="noitu-result-message" aria-live="assertive">
            <span className="noitu-result-kicker">VÁN ĐÃ KHÉP LẠI</span>
            <h1>{activeGame.winnerId ? `${activeGame.players.find((item) => item.id === activeGame.winnerId)?.nickname ?? 'Người chơi'} thắng ván này!` : 'Ván kết thúc.'}</h1>
            <p>{activeCount} người còn lại · {activeGame.usedCount} từ đã được dùng</p>
            {snapshot.players.find((item) => item.isHost)?.isYou ? <button className="button button-primary" type="button" disabled={busy || !connected} onClick={onRematch}>Chơi lại</button> : <span>Chờ chủ phòng bắt đầu ván mới.</span>}
          </li>}
          <li className="noitu-dictionary-footnote">Từ điển thử nghiệm · từ do nhóm chấp nhận chỉ có hiệu lực trong ván này.</li>
        </ol>
        {!followLatest && <button className="noitu-jump-latest" type="button" onClick={jumpToLatest}>Về lượt hiện tại ↓</button>}
      </section>

      <section className="noitu-dock" aria-label="Hành động lượt chơi">
        {proposal && <div className="noitu-vote-dock">
          <div className="noitu-dock-status"><b>{proposal.canVote ? 'Bạn chấp nhận từ này?' : proposal.proposerId === playerId ? 'Đang chờ nhóm biểu quyết' : 'Bạn không có quyền biểu quyết'}</b><span>{proposal.acceptCount} nhận · {proposal.rejectCount} bác · cần quá nửa số phiếu hợp lệ</span></div>
          {proposal.canVote && <div className="noitu-dock-actions"><button className="button button-primary" type="button" disabled={busy || !connected || snapshot.paused} onClick={() => void vote('accept')}>Chấp nhận</button><button className="button button-secondary" type="button" disabled={busy || !connected || snapshot.paused} onClick={() => void vote('reject')}>Bác bỏ</button></div>}
        </div>}
        {!proposal && activeGame.phase === 'turn' && isMyTurn && <form className="noitu-composer" onSubmit={(event) => void submit(event)}>
          <span className="noitu-compose-label">Tiếng cần nối <b>{activeGame.requiredSyllable}</b></span>
          <label className="noitu-compose-field" htmlFor="noitu-suffix"><span className="sr-only">Tiếng bạn nối</span><input ref={inputRef} id="noitu-suffix" type="text" value={suffix} onChange={(event) => { setSuffix(event.target.value); setFormError(''); }} onCompositionStart={() => setComposing(true)} onCompositionEnd={compositionEnd} onKeyDown={(event) => { if (event.key === 'Enter' && (composing || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)) event.preventDefault(); }} maxLength={64} autoComplete="off" autoCapitalize="none" spellCheck={false} inputMode="text" placeholder="Nhập tiếng tiếp theo…" aria-label={`Tiếng cần nối là ${activeGame.requiredSyllable}. Nhập tiếng tiếp theo`} aria-describedby={formError ? 'noitu-form-error' : 'noitu-compose-help'} disabled={!connected || snapshot.paused || sending} />
            <button className="button button-primary" type="submit" disabled={!activeGame.canSubmit || busy || sending || !connected || snapshot.paused}>{sending ? 'Đang gửi…' : 'Gửi'}</button>
          </label>
          <div className="noitu-compose-meta">
            <span id="noitu-compose-help" className="noitu-compose-hint">{formError ? <span id="noitu-form-error" role="alert">{formError}</span> : `Đề xuất ngoài từ điển ${activeGame.proposalsThisTurn}/2`}</span>
            <span className={`noitu-dock-clock${(seconds ?? 99) <= 5 ? ' is-urgent' : ''}`} aria-label={`${seconds ?? 0} giây còn lại`}>{seconds ?? 0}s</span>
            <button ref={giveUpTriggerRef} className="button button-quiet noitu-forfeit" type="button" disabled={!mayGiveUp} onClick={openGiveUpDialog}>Chịu thua</button>
          </div>
        </form>}
        {!proposal && activeGame.phase === 'turn' && !isMyTurn && <div className="noitu-dock-status"><b>{player?.status === 'eliminated' ? 'Bạn đang xem ván' : `Đang chờ ${current?.nickname ?? 'người chơi'} nối từ`}</b><span>{player?.status === 'eliminated' ? 'Bạn đã bị loại và không thể gửi từ hoặc biểu quyết.' : activeDraftSuffix ? 'Người chơi đang nhập từ của họ.' : 'Đồng hồ sẽ giữ nguyên nếu ván tạm dừng.'}</span></div>}
        {!proposal && activeGame.phase === 'finished' && <div className="noitu-dock-status"><b>{snapshot.players.find((item) => item.isHost)?.isYou ? 'Bạn là chủ phòng' : 'Ván đã kết thúc'}</b><span>{snapshot.players.find((item) => item.isHost)?.isYou ? 'Bắt đầu ván mới khi mọi người sẵn sàng.' : 'Chờ chủ phòng bắt đầu ván mới.'}</span></div>}
      </section>
    </main>
    {giveUpTarget && <div className="modal-backdrop noitu-giveup-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) dismissGiveUpDialog(); }}>
      <section ref={giveUpDialogRef} className="modal-card noitu-giveup-dialog" role="dialog" aria-modal="true" aria-labelledby="noitu-giveup-title" aria-describedby="noitu-giveup-description" aria-busy={giveUpPending} tabIndex={-1} onKeyDown={handleGiveUpDialogKeyDown}>
        <p className="eyebrow">NỐI TỪ · XÁC NHẬN</p>
        <h2 id="noitu-giveup-title">Chịu thua ván này?</h2>
        <p id="noitu-giveup-description">Bạn sẽ bị loại khỏi ván hiện tại và vẫn có thể ở lại xem mọi người chơi.</p>
        {giveUpError && <p className="noitu-giveup-error" role="alert">{giveUpError}</p>}
        <div className="noitu-giveup-actions">
          <button ref={giveUpContinueRef} className="button button-secondary" type="button" disabled={giveUpPending} onClick={dismissGiveUpDialog}>Tiếp tục chơi</button>
          <button className="button noitu-giveup-confirm" type="button" disabled={giveUpPending || busy || !connected || snapshot.paused} onClick={() => void confirmGiveUp()}>{giveUpPending ? 'Đang gửi…' : 'Chịu thua'}</button>
        </div>
      </section>
    </div>}
  </div>;
}
