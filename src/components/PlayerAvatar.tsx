import type { ReactNode } from 'react';

export const AVATAR_COUNT = 12;
export const AVATAR_LABELS = ['Mèo', 'Gấu', 'Ếch', 'Cáo', 'Robot', 'Mây', 'Dâu', 'Sao', 'Trăng', 'Ma nhỏ', 'Vịt', 'Thỏ'] as const;

const colors = ['#f5a982', '#a87958', '#69c9aa', '#f1a14e', '#a3b6d5', '#bbd9eb', '#ee7586', '#f1ca6d', '#a89add', '#f6f3e9', '#f4ca53', '#d2b7ed'];

function Face({ id }: { id: number }) {
  const eyes = <><circle cx="25" cy="35" r="2.2" fill="#28232b"/><circle cx="39" cy="35" r="2.2" fill="#28232b"/></>;
  const smile = <path d="M28 43q4 4 8 0" fill="none" stroke="#49323a" strokeWidth="2" strokeLinecap="round"/>;
  const features: ReactNode[] = [
    <><path d="M13 26 17 9l12 11M51 26 47 9 35 20" fill="#f5a982" stroke="#49323a" strokeWidth="2"/><circle cx="32" cy="41" r="2" fill="#d56d75"/>{eyes}<path d="M27 45q5 5 10 0" fill="none" stroke="#49323a" strokeWidth="2"/></>,
    <><circle cx="17" cy="17" r="7" fill="#a87958"/><circle cx="47" cy="17" r="7" fill="#a87958"/>{eyes}<ellipse cx="32" cy="42" rx="7" ry="5" fill="#f5d1ad"/><circle cx="32" cy="40" r="2" fill="#322b2a"/></>,
    <><circle cx="22" cy="20" r="8" fill="#69c9aa"/><circle cx="42" cy="20" r="8" fill="#69c9aa"/>{eyes}<path d="M25 43q7 5 14 0" fill="none" stroke="#285342" strokeWidth="2"/></>,
    <><path d="M12 27 17 8l13 13M52 27 47 8 34 21" fill="#f1a14e" stroke="#754124" strokeWidth="2"/>{eyes}<path d="m27 43 5 5 5-5" fill="#fff6e9" stroke="#754124" strokeWidth="2"/></>,
    <><rect x="15" y="19" width="34" height="29" rx="6" fill="#dbe6f4" stroke="#4e6784" strokeWidth="2"/><path d="M32 19v-6m-3-1h6" stroke="#4e6784" strokeWidth="2"/>{eyes}<path d="M27 42h10" stroke="#4e6784" strokeWidth="2"/></>,
    <><path d="M16 44c-10 0-10-15 0-17 1-11 16-16 23-8 12-3 20 9 13 18 2 7-4 12-11 12H18" fill="#e7f5ff" stroke="#6a91ab" strokeWidth="2"/>{eyes}{smile}</>,
    <><path d="M32 17q-3-8 4-10m-5 12q-8-10-16-5 3 9 16 5" fill="#78b979" stroke="#426e4d" strokeWidth="2"/>{eyes}<circle cx="23" cy="41" r="2" fill="#efb5bc"/><circle cx="41" cy="41" r="2" fill="#efb5bc"/>{smile}</>,
    <><path d="m32 9 5 11 12 2-9 8 2 13-10-6-10 6 2-13-9-8 12-2z" fill="#fff3be" stroke="#8e6a29" strokeWidth="2"/>{eyes}{smile}</>,
    <><path d="M43 13a21 21 0 1 0 8 29 20 20 0 0 1-8-29" fill="#eee8ff" stroke="#665b93" strokeWidth="2"/>{eyes}{smile}</>,
    <><path d="M17 49V31a15 15 0 0 1 30 0v18l-7-4-8 4-8-4z" fill="#fffdf4" stroke="#938b96" strokeWidth="2"/>{eyes}<ellipse cx="32" cy="42" rx="3" ry="4" fill="#42384a"/></>,
    <><path d="M13 31q3-16 19-16t19 16" fill="#f4ca53" stroke="#765c2c" strokeWidth="2"/>{eyes}<path d="m29 40 12 3-12 3z" fill="#ec865b" stroke="#765c2c" strokeWidth="1.5"/></>,
    <><path d="M19 23V6q8 0 9 16M36 22q1-16 9-16v18" fill="#d2b7ed" stroke="#76618e" strokeWidth="2"/>{eyes}<path d="M31 42h2m-1 0v3" stroke="#76618e" strokeWidth="2" strokeLinecap="round"/></>,
  ];
  return features[id] ?? features[0];
}

export default function PlayerAvatar({ id = 0, className = '', label }: { id?: number; className?: string; label?: string }) {
  const safeId = Number.isInteger(id) && id >= 0 && id < AVATAR_COUNT ? id : 0;
  return <span className={`avatar avatar-art ${className}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true"><circle cx="32" cy="32" r="30" fill={colors[safeId]}/><Face id={safeId}/></svg>
  </span>;
}
