import { useState } from 'react';
import PlayerAvatar, { AVATAR_COUNT, AVATAR_LABELS } from '../components/PlayerAvatar';
import './cotuong.css';

export type CotuongLocalSetup = {
  redNickname: string;
  blackNickname: string;
  redAvatarId: number;
  blackAvatarId: number;
  clock: null | { baseMinutes: 5 | 10 | 15; incrementSeconds: 0 | 3 | 5 };
};

type Props = {
  nickname: string;
  avatarId: number;
  busy: boolean;
  onClose: () => void;
  onOnline: () => void;
  onLocal: (setup: CotuongLocalSetup) => void;
};

export default function CotuongStartDialog({ nickname, avatarId, busy, onClose, onOnline, onLocal }: Props) {
  const [mode, setMode] = useState<'choose' | 'local'>('choose');
  const [redNickname, setRedNickname] = useState(nickname);
  const [blackNickname, setBlackNickname] = useState('Người chơi 2');
  const [redAvatarId, setRedAvatarId] = useState(avatarId);
  const [blackAvatarId, setBlackAvatarId] = useState((avatarId + 1) % AVATAR_COUNT);
  const [timed, setTimed] = useState(false);
  const [baseMinutes, setBaseMinutes] = useState<5 | 10 | 15>(10);
  const [incrementSeconds, setIncrementSeconds] = useState<0 | 3 | 5>(3);

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal-card cotuong-mode-dialog" role="dialog" aria-modal="true" aria-labelledby="cotuong-start-title">
      <button className="icon-button modal-close" type="button" aria-label="Đóng" onClick={onClose}>×</button>
      <p className="eyebrow">CỜ TƯỚNG · HQ-COTUONG-1</p>
      <h2 id="cotuong-start-title">{mode === 'choose' ? 'Chọn chế độ' : 'Thiết lập 2P'}</h2>
      {mode === 'choose' ? <div className="cotuong-mode-options">
        <button className="cotuong-mode-option" type="button" onClick={onOnline}><strong>Online</strong><span>Mỗi người dùng một thiết bị, kết nối qua phòng.</span></button>
        <button className="cotuong-mode-option" type="button" onClick={() => setMode('local')}><strong>2P</strong><span>Hai người thay lượt trên cùng một thiết bị.</span></button>
      </div> : <>
        <div className="cotuong-local-player-pair">
          <label className="cotuong-local-form"><span>Người chơi Đỏ</span><span className="cotuong-local-avatar"><PlayerAvatar id={redAvatarId} /><select aria-label="Hình người chơi Đỏ" value={redAvatarId} onChange={(event) => setRedAvatarId(Number(event.target.value))}>{AVATAR_LABELS.map((label, id) => <option key={label} value={id}>{label}</option>)}</select></span><input maxLength={24} value={redNickname} onChange={(event) => setRedNickname(event.target.value)} placeholder="Tên người chơi Đỏ" /></label>
          <label className="cotuong-local-form"><span>Người chơi Đen</span><span className="cotuong-local-avatar"><PlayerAvatar id={blackAvatarId} /><select aria-label="Hình người chơi Đen" value={blackAvatarId} onChange={(event) => setBlackAvatarId(Number(event.target.value))}>{AVATAR_LABELS.map((label, id) => <option key={label} value={id}>{label}</option>)}</select></span><input maxLength={24} value={blackNickname} onChange={(event) => setBlackNickname(event.target.value)} placeholder="Tên người chơi Đen" /></label>
        </div>
        <label className="settings-toggle-row cotuong-clock-toggle"><span><b>Dùng đồng hồ</b><small>Tắt theo mặc định cho một màn hình.</small></span><input type="checkbox" checked={timed} onChange={(event) => setTimed(event.target.checked)} /></label>
        {timed && <div className="cotuong-local-clock"><label>Thời gian<select value={baseMinutes} onChange={(event) => setBaseMinutes(Number(event.target.value) as typeof baseMinutes)}><option value={5}>5 phút</option><option value={10}>10 phút</option><option value={15}>15 phút</option></select></label><label>Cộng thêm<select value={incrementSeconds} onChange={(event) => setIncrementSeconds(Number(event.target.value) as typeof incrementSeconds)}><option value={0}>0 giây/nước</option><option value={3}>3 giây/nước</option><option value={5}>5 giây/nước</option></select></label></div>}
        <div className="settings-dialog-actions"><button className="button button-quiet" type="button" disabled={busy} onClick={() => setMode('choose')}>Quay lại</button><button className="button button-primary button-large" type="button" disabled={busy || !redNickname.trim() || !blackNickname.trim()} onClick={() => onLocal({ redNickname: redNickname.trim(), blackNickname: blackNickname.trim(), redAvatarId, blackAvatarId, clock: timed ? { baseMinutes, incrementSeconds } : null })}>{busy ? 'Đang mở bàn…' : 'Bắt đầu ván'}</button></div>
      </>}
    </section>
  </div>;
}
