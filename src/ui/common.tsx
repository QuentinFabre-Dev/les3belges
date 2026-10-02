import { useEffect, useRef, type ReactNode } from 'react';
import { atlasLook, CHAR_H, CHAR_W, drawFrame } from '../render/sprites';
import type { SectorId, Severity } from '../sim/types';

const ICONS: Record<string, string> = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  layers: 'M12 3l9 5-9 5-9-5 9-5zm-9 9l9 5 9-5M3 16l9 5 9-5',
  users: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 19v-1a4 4 0 0 0-3-3.9M15.5 3.2a3.5 3.5 0 0 1 0 6.6',
  box: 'M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8',
  cog: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  alert: 'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
  check: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  landmark: 'M3 21h18M5 21V10M19 21V10M9 21V10M15 21V10M2 10l10-6 10 6',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15zM20 17v5H6.5A2.5 2.5 0 0 1 4 19.5',
  leaf: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10zM2 21c0-3 1.9-5.4 5.1-6',
  drop: 'M12 2.7l5.7 5.7a8 8 0 1 1-11.4 0z',
  bolt: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  cube: 'M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7zM3.3 7L12 12l8.7-5M12 22V12',
  wrench: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8z',
  pill: 'M10.5 20.5a7 7 0 0 1-9.9-9.9l10-10a7 7 0 0 1 9.9 9.9zM8.5 8.5l7 7',
  pause: 'M6 4h4v16H6zM14 4h4v16h-4z',
  play: 'M6 4l14 8-14 8z',
  ff: 'M3 4l9 8-9 8zM12 4l9 8-9 8z',
  fff: 'M2 5l6 7-6 7zM9 5l6 7-6 7zM16 5l6 7-6 7z',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  chevron: 'M9 18l6-6-6-6',
  x: 'M18 6L6 18M6 6l12 12',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  zoomIn: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3M11 8v6M8 11h6',
  zoomOut: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3M8 11h6',
  target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  megaphone: 'M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1zM16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z',
  skull: 'M12 2a8 8 0 0 0-8 8c0 3 1.5 5 3 6v3h10v-3c1.5-1 3-3 3-6a8 8 0 0 0-8-8zM9 12h.01M15 12h.01M10 19v2M14 19v2',
};

export function Icon({ name, size = 18, color = 'currentColor', fill = false }: { name: keyof typeof ICONS | string; size?: number; color?: string; fill?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? color : 'none'} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[name] ?? ICONS.box} />
    </svg>
  );
}

export function Bar({ value, max = 100, color, height = 6 }: { value: number; max?: number; color?: string; height?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const c = color ?? (pct > 66 ? 'var(--ok)' : pct > 40 ? 'var(--warn)' : 'var(--bad)');
  return (
    <div className="bar" style={{ height }}>
      <div style={{ width: `${pct}%`, background: c }} />
    </div>
  );
}

export function Stat({ label, value, children }: { label: string; value?: ReactNode; children?: ReactNode }) {
  return (
    <div className="stat">
      <span className="muted">{label}</span>
      <span>{value}</span>
      {children}
    </div>
  );
}

export function Sparkline({ data, color = 'var(--accent)', height = 28, width = 120, max = 100 }: { data: number[]; color?: string; height?: number; width?: number; max?: number }) {
  if (data.length < 2) return <svg width={width} height={height} />;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(height - (Math.max(0, Math.min(max, v)) / max) * (height - 2) - 1).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} className="spark">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

export const severityColor = (s: Severity) => ({ info: 'var(--info)', attention: 'var(--warn)', important: 'var(--orange)', critical: 'var(--bad)' })[s];
export const severityLabel = (s: Severity) => ({ info: 'Info', attention: 'Attention', important: 'Important', critical: 'Critique' })[s];

export function Portrait({ portrait, sector, look, size = 56 }: { portrait?: string; sector?: SectorId; look?: number; size?: number }) {
  if (portrait) return <img className="portrait" src={`${import.meta.env.BASE_URL}assets/portraits/${portrait}.png`} width={size} height={size} alt="" />;
  return <Avatar sector={sector ?? 'residential'} look={look ?? 0} size={size} />;
}

// Avatar dessiné avec le même générateur que les sprites du silo (tête et buste agrandis).
export function Avatar({ sector, look, size = 56 }: { sector: SectorId; look: number; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const tmp = document.createElement('canvas');
    tmp.width = CHAR_W;
    tmp.height = CHAR_H;
    drawFrame(tmp.getContext('2d')!, 0, 0, atlasLook(sector, look), 0);
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#2b333d';
    ctx.fillRect(0, 0, c.width, c.height);
    // cadrage buste : 12×14 premiers pixels
    ctx.drawImage(tmp, 0, 0, CHAR_W, 14, 0, 2, c.width, (c.width * 14) / CHAR_W);
  }, [sector, look]);
  return <canvas ref={ref} className="portrait" width={size} height={size} />;
}

export function RoomThumb({ room, height = 90 }: { room?: string; height?: number }) {
  if (!room) return null;
  return <div className="room-thumb" style={{ height, backgroundImage: `url(${import.meta.env.BASE_URL}assets/rooms/${room}.png)` }} />;
}

export function Panel({ title, onClose, children, actions }: { title: ReactNode; onClose?: () => void; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="panel overlay-panel">
      <header>
        <h2>{title}</h2>
        <div className="row gap">
          {actions}
          {onClose && (
            <button className="icon-btn" onClick={onClose} aria-label="Fermer">
              <Icon name="x" />
            </button>
          )}
        </div>
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}

export const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR');
export const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : fmt(n));
