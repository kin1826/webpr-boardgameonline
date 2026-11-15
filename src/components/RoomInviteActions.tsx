import { useState } from 'react';

type Props = { code: string };

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(value); return; } catch { /* HTTP LAN: dùng cách sao chép dự phòng. */ }
  }
  const input = document.createElement('textarea');
  input.value = value;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  if (!copied) throw new Error('Không thể sao chép trên trình duyệt này.');
}

export default function RoomInviteActions({ code }: Props) {
  const [notice, setNotice] = useState('');
  const inviteUrl = `${window.location.origin}/?room=${encodeURIComponent(code)}`;

  async function copyCode() {
    try { await copyText(code); setNotice('Đã sao chép mã phòng.'); }
    catch { setNotice('Không sao chép được mã. Hãy chọn mã để chép thủ công.'); }
  }

  async function shareLink() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Vào phòng Hội Quậy', text: `Mã phòng: ${code}`, url: inviteUrl });
        setNotice('Đã mở chia sẻ.');
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try { await copyText(inviteUrl); setNotice('Đã sao chép link mời.'); }
    catch { setNotice('Không mở được chia sẻ. Hãy chép mã phòng.'); }
  }

  return <div className="room-invite-actions">
    <button type="button" className="button button-secondary" onClick={() => void copyCode()} aria-label="Sao chép mã phòng">Sao chép</button>
    <button type="button" className="button button-secondary" onClick={() => void shareLink()} aria-label="Chia sẻ link mời">Chia sẻ link</button>
    <span className="room-invite-status" role="status" aria-live="polite">{notice}</span>
  </div>;
}
