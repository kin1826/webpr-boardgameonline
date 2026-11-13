// Lucian UX/UI Prompt #008 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#008
import { useEffect, useRef, useState } from 'react';

type ShareMode = 'link' | 'code' | 'both';

type CopyInviteCardProps = {
  roomCode: string;
};

const tabs: { id: ShareMode; label: string }[] = [
  { id: 'link', label: 'Link mời' },
  { id: 'code', label: 'Mã phòng' },
  { id: 'both', label: 'Cả hai' },
];

export default function CopyInviteCard({ roomCode }: CopyInviteCardProps) {
  const [mode, setMode] = useState<ShareMode>('link');
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const origin = window.location.origin;
  const invite = `${origin}/?room=${roomCode}`;
  const content = mode === 'link' ? invite : mode === 'code' ? roomCode : `${invite} · Mã phòng: ${roomCode}`;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      const area = document.createElement('textarea');
      area.value = content;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    window.clearTimeout(timer.current);
    setCopied(false);
    requestAnimationFrame(() => setCopied(true));
    timer.current = window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className={`ux u008${copied ? ' is-copied' : ''}`}>
      <div className="u008-tabs" role="tablist" aria-label="Chọn nội dung chia sẻ">
        {tabs.map((tab) => (
          <button
            className="u008-tab"
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={mode === tab.id}
            tabIndex={mode === tab.id ? 0 : -1}
            onClick={() => setMode(tab.id)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
              event.preventDefault();
              const current = tabs.findIndex((item) => item.id === mode);
              const next = (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
              setMode(tabs[next].id);
              document.getElementById(`share-tab-${tabs[next].id}`)?.focus();
            }}
            id={`share-tab-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="u008-box">
        <code className="u008-code" title={content}>
          <em aria-hidden="true">↗</em>
          <span className="u008-cmd">{content}</span>
        </code>
        <button className="u008-btn" type="button" aria-label="Sao chép thông tin mời" onClick={copy}>
          <svg className="u008-cp" viewBox="0 0 24 24" aria-hidden="true"><rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/></svg>
          <svg className="u008-ok" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.5l4.2 4.2L18.5 8"/></svg>
        </button>
        <span className="u008-tip" role="status" aria-live="polite">{copied ? 'Đã sao chép' : ''}</span>
      </div>
    </div>
  );
}
