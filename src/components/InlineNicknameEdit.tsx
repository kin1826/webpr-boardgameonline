// Lucian UX/UI Prompt #033 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#033
import { useEffect, useRef, useState } from 'react';

type InlineNicknameEditProps = {
  name: string;
  onSave: (name: string) => void;
};

export default function InlineNicknameEdit({ name, onSave }: InlineNicknameEditProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [saved, setSaved] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const viewRef = useRef<HTMLButtonElement>(null);
  const savedTimer = useRef<number | undefined>(undefined);
  const edit = () => {
    setValue(name);
    setEditing(true);
  };

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => () => window.clearTimeout(savedTimer.current), []);

  function finish(save: boolean) {
    if (!editing) return;
    const next = value.trim();
    if (save && !next) {
      setInvalid(true);
      inputRef.current?.focus();
      return;
    }
    setEditing(false);
    setInvalid(false);
    if (save && next !== name) {
      onSave(next.slice(0, 24));
      setSaved(true);
      window.clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => setSaved(false), 1800);
    }
    requestAnimationFrame(() => viewRef.current?.focus());
  }

  return (
    <div className={`ux u033${editing ? ' is-edit' : ''}${invalid ? ' is-shake' : ''}`}>
      <div className="u033-crumb"><i aria-hidden="true" />Biệt danh <span aria-hidden="true">/</span> Bàn Bạn</div>
      <div className="u033-row">
        <button ref={viewRef} className={`u033-view${saved ? ' flash' : ''}`} type="button" aria-label={`Sửa biệt danh: ${name}`} onClick={edit}>{name}</button>
        <button className="u033-pen" type="button" aria-label="Sửa biệt danh" onClick={edit}>
          <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M11.5 3.5l3 3L6 15H3v-3z"/></svg>
        </button>
        <div className="u033-edit">
          <input
            ref={inputRef}
            className="u033-in"
            type="text"
            aria-label="Biệt danh mới"
            maxLength={24}
            value={value}
            onChange={(event) => { setValue(event.target.value); setInvalid(false); }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === 'Enter') { event.preventDefault(); finish(true); }
              if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(false); }
            }}
          />
          <button className="u033-act ok" type="button" aria-label="Lưu biệt danh" onClick={() => finish(true)}>
            <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M4 9.5l3.2 3.2L14 5.5"/></svg>
          </button>
          <button className="u033-act no" type="button" aria-label="Hủy sửa" onClick={() => finish(false)}>
            <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M5 5l8 8M13 5l-8 8"/></svg>
          </button>
          <span className="u033-line" aria-hidden="true" />
        </div>
      </div>
      <div className="u033-meta">
        <span className="u033-av" aria-hidden="true" />
        <span>Chỉ lưu trên thiết bị này</span>
        <span className={`u033-when${saved ? ' is-new' : ''}`} aria-live="polite">{invalid ? 'Tên không được để trống' : saved ? 'Đã lưu' : 'Nhấn tên để chỉnh sửa'}</span>
      </div>
    </div>
  );
}
