import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

type Target = { id: string; nickname: string };
export function useKickConfirmation() {
  const [target, setTarget] = useState<Target | null>(null);
  return { target, request: (id: string, nickname: string) => setTarget({ id, nickname }), close: () => setTarget(null) };
}

export default function ConfirmKickDialog({ target, inGame, disabled, onCancel, onConfirm }: {
  target: Target | null; inGame: boolean; disabled: boolean;
  onCancel: () => void; onConfirm: (id: string) => Promise<{ ok: boolean }>;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const lock = useRef(false);
  const cancelCallback = useRef(onCancel); cancelCallback.current = onCancel;
  useEffect(() => {
    if (!target) return;
    const previous = document.activeElement;
    cancelRef.current?.focus();
    const key = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape' && !lock.current) cancelCallback.current(); };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, [target?.id]);
  if (!target) return null;
  async function confirm() {
    if (!target || disabled || lock.current) return;
    lock.current = true; setSubmitting(true);
    try { if ((await onConfirm(target.id)).ok) onCancel(); }
    finally { lock.current = false; setSubmitting(false); }
  }
  function trap(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Tab') return;
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onCancel(); }}>
    <section className="modal-card caro-resign-dialog" role="dialog" aria-modal="true" aria-labelledby="kick-dialog-title" onKeyDown={trap}>
      <h2 id="kick-dialog-title">Mời {target.nickname} ra khỏi phòng?</h2>
      <p>{inGame ? 'Thao tác này sẽ hủy ván hiện tại và đưa người còn lại về phòng chờ.' : 'Người này sẽ rời ghế hiện tại. Mọi người cần sẵn sàng lại.'}</p>
      <div className="caro-dialog-actions"><button ref={cancelRef} className="button button-secondary" type="button" disabled={submitting} onClick={onCancel}>Hủy</button><button className="button button-primary" type="button" disabled={disabled || submitting} onClick={() => void confirm()}>{submitting ? 'Đang xử lý…' : 'Mời ra'}</button></div>
    </section>
  </div>;
}
