import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { GAME_CATALOG, type GameKey, type GameSettings, type RoomVisibility } from '@banban/shared';
import type { GameAvailability } from '../api/http';

type Props = {
  gameKey: GameKey;
  initialSettings: GameSettings;
  options: GameAvailability['options'];
  visibility?: RoomVisibility;
  includeVisibility?: boolean;
  busy: boolean;
  title: string;
  submitLabel: string;
  onClose: () => void;
  onSave: (settings: GameSettings, visibility?: RoomVisibility) => void;
};

export default function RoomSettingsDialog({ gameKey, initialSettings, options, visibility: initialVisibility = 'private', includeVisibility = false, busy, title, submitLabel, onClose, onSave }: Props) {
  const [turnSeconds, setTurnSeconds] = useState(initialSettings.turnSeconds);
  const [targetScore, setTargetScore] = useState(initialSettings.targetScore);
  const [stacking, setStacking] = useState(initialSettings.gameKey === 'uno' ? initialSettings.stacking : true);
  const [boardSize, setBoardSize] = useState(initialSettings.gameKey === 'caro' ? initialSettings.boardSize : 15);
  const [winLength, setWinLength] = useState(initialSettings.gameKey === 'caro' ? initialSettings.winLength : 5);
  const [roomVisibility, setRoomVisibility] = useState(initialVisibility);
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => { dialogRef.current?.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled])')?.focus(); }, []);

  const submit = () => {
    const settings: GameSettings = gameKey === 'uno'
      ? { gameKey, turnSeconds, targetScore, stacking }
      : gameKey === 'caro'
        ? { gameKey, turnSeconds, targetScore, boardSize, winLength }
        : { gameKey, turnSeconds, targetScore };
    onSave(settings, includeVisibility ? roomVisibility : undefined);
  };
  const keepFocusInside = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
    if (event.key !== 'Tab') return;
    const elements = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled])')];
    const first = elements[0]; const last = elements[elements.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  return <div className="modal-backdrop room-settings-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} className="modal-card room-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="room-settings-title" tabIndex={-1} onKeyDown={keepFocusInside}>
      <button className="icon-button modal-close" type="button" aria-label="Đóng cài đặt" onClick={onClose}>×</button>
      <p className="eyebrow">{GAME_CATALOG[gameKey].name.toUpperCase()} · CẤU HÌNH PHÒNG</p>
      <h2 id="room-settings-title">{title}</h2>
      {includeVisibility && <fieldset className="settings-choice-group">
        <legend>Ai có thể vào?</legend>
        <div className="settings-visibility-options">
          {(['private', 'public'] as const).map((value) => <button key={value} type="button" className={`settings-option${roomVisibility === value ? ' is-selected' : ''}`} aria-pressed={roomVisibility === value} onClick={() => setRoomVisibility(value)}>
            <strong>{value === 'private' ? 'Riêng tư' : 'Công khai'}</strong><small>{value === 'private' ? 'Chỉ vào bằng mã phòng' : 'Hiện trong danh sách phòng'}</small>
          </button>)}
        </div>
      </fieldset>}
      <div className="settings-fields">
        <label><span>Điểm để thắng trận</span><small>Thắng mỗi ván được +10 điểm</small>
          <input type="number" min={options.targetScoreMin} max={options.targetScoreMax} step={options.targetScoreStep} value={targetScore} onChange={(event) => setTargetScore(Number(event.target.value))} />
        </label>
        <label><span>Thời gian mỗi lượt</span><small>Hết giờ thì người chơi bị loại khỏi ván</small>
          <select value={turnSeconds} onChange={(event) => setTurnSeconds(Number(event.target.value) as typeof turnSeconds)}>{options.turnSeconds.map((seconds) => <option key={seconds} value={seconds}>{seconds} giây</option>)}</select>
        </label>
        {gameKey === 'uno' && <label className="settings-toggle-row"><span><b>Cộng dồn lá +</b><small>Khi tắt, người nhận phạt phải rút bài</small></span><input type="checkbox" checked={stacking} onChange={(event) => setStacking(event.target.checked)} /></label>}
        {gameKey === 'caro' && <>
          <label><span>Kích thước bàn</span><select value={boardSize} onChange={(event) => setBoardSize(Number(event.target.value) as typeof boardSize)}>{(options.boardSizes ?? [9, 15, 19]).map((size) => <option key={size} value={size}>{size} × {size}</option>)}</select></label>
          <label><span>Số quân để thắng</span><select value={winLength} onChange={(event) => setWinLength(Number(event.target.value) as typeof winLength)}>{(options.winLengths ?? [4, 5, 6]).map((length) => <option key={length} value={length}>{length} quân</option>)}</select></label>
        </>}
      </div>
      <p className="settings-summary">{targetScore} điểm · {turnSeconds} giây mỗi lượt{gameKey === 'uno' ? ` · ${stacking ? 'Có' : 'Không'} cộng dồn` : gameKey === 'caro' ? ` · Bàn ${boardSize}×${boardSize} · nối ${winLength}` : ''}</p>
      <div className="settings-dialog-actions"><button className="button button-quiet" type="button" disabled={busy} onClick={onClose}>Hủy</button><button className="button button-primary button-large" type="button" disabled={busy || targetScore < options.targetScoreMin || targetScore > options.targetScoreMax || targetScore % options.targetScoreStep !== 0} onClick={submit}>{busy ? 'Đang lưu…' : submitLabel}</button></div>
    </section>
  </div>;
}
