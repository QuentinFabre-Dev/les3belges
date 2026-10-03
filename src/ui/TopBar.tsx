import { send, useGame } from '../game/store';
import type { Speed } from '../sim/types';
import { Icon, fmt } from './common';

const RES_ICONS: Record<string, [string, string]> = {
  food: ['leaf', '#6fbf4a'],
  water: ['drop', '#4aa8e0'],
  energy: ['bolt', '#f0c030'],
  materials: ['cube', '#d0a070'],
};

export function TopBar() {
  const s = useGame((g) => g.snapshot);
  const setView = useGame((g) => g.setView);
  if (!s) return <header className="topbar" />;
  const night = s.hour >= 22 || s.hour < 6;
  const speeds: [Speed, string, string][] = [
    [0, 'pause', 'Pause'],
    [1, 'play', 'Vitesse ×1 : une minute par seconde'],
    [5, 'ff', 'Vitesse ×5 : une heure en 12 secondes'],
    [30, 'fff', 'Vitesse ×30 : une journée en 48 secondes'],
    [120, 'fff', 'Vitesse ×120 : une journée en 12 secondes'],
  ];
  return (
    <header className="topbar">
      <div className="brand">
        <svg width="38" height="38" viewBox="0 0 38 38" aria-hidden>
          <polygon points="19,2 34,10 34,28 19,36 4,28 4,10" fill="none" stroke="#9aa5b1" strokeWidth="2" />
          {[10, 15, 20, 25].map((y) => (
            <line key={y} x1="11" x2="27" y1={y + 1} y2={y + 1} stroke="#9aa5b1" strokeWidth="1.5" />
          ))}
          <line x1="19" x2="19" y1="9" y2="29" stroke="#9aa5b1" strokeWidth="1.5" />
        </svg>
        <div>
          <div className="brand-title">SILO-01</div>
          <div className="brand-sub">GESTION EXTERNE</div>
        </div>
      </div>
      <div className="resources" data-tut="resources">
        <button className="res" onClick={() => setView('population')} title="Population totale du silo">
          <Icon name="users" size={26} color="#c8ced6" />
          <div>
            <div className="res-label">Population</div>
            <div className="res-value">
              {fmt(s.population)} <small className={s.popTrend >= 0 ? 'up' : 'down'}>{s.popTrend >= 0 ? '+' : ''}{s.popTrend}/j</small>
            </div>
          </div>
        </button>
        {s.resources
          .filter((r) => RES_ICONS[r.key])
          .map((r) => {
            const [icon, color] = RES_ICONS[r.key];
            const trend = r.key === 'energy' ? r.trend : r.trend;
            const trendLabel = r.key === 'energy' ? (trend >= 0 ? 'stable' : `${trend} kW`) : Math.abs(trend) < r.capacity * 0.002 ? 'stable' : `${trend > 0 ? '↑' : '↓'} ${Math.abs(Math.round((trend / r.capacity) * 100 * 10) / 10)}%/j`;
            const tip =
              r.key === 'energy'
                ? `Production ${r.stock} kW · demande ${r.capacity} kW · batteries ${Math.round(r.days)} %`
                : `${fmt(r.stock)} / ${fmt(r.capacity)} (déclaré) · autonomie ≈ ${r.days.toFixed(1)} j · flux ${trend > 0 ? '+' : ''}${fmt(trend)}/j`;
            return (
              <button key={r.key} className="res" onClick={() => setView('resources')} title={tip}>
                <Icon name={icon} size={26} color={color} fill />
                <div>
                  <div className="res-label">{r.label}</div>
                  <div className="res-value">
                    <span className={r.pct < 25 ? 'bad' : r.pct < 45 ? 'warn' : ''}>{r.pct}%</span>{' '}
                    <small className={trendLabel === 'stable' ? 'muted' : trend > 0 ? 'up' : 'down'}>{trendLabel}</small>
                  </div>
                </div>
              </button>
            );
          })}
        <div className="res stab" title="Stabilité générale du silo">
          <div>
            <div className="res-label">Stabilité</div>
            <div className="res-value">
              <span className={s.stability < 35 ? 'bad' : s.stability < 55 ? 'warn' : ''}>{s.stability}</span>
              <small className="muted"> /100</small>
            </div>
          </div>
        </div>
      </div>
      <div className="clock">
        <div>
          <div className="res-label" title={`Mandat : année ${s.calendar.mandateYear} sur ${s.calendar.mandateYears}${s.calendar.freeMode ? ' (partie libre)' : ''}`}>
            An {s.calendar.year} · J{s.calendar.dayOfYear}/{s.calendar.yearDays}
          </div>
          <div className="res-value">
            {String(s.hour).padStart(2, '0')}:{String(s.minute).padStart(2, '0')}
          </div>
        </div>
        <Icon name={night ? 'moon' : 'sun'} size={22} color={night ? '#8fb3e0' : '#f0c030'} />
        <div className="speeds" data-tut="speeds">
          {speeds.map(([sp, icon, label]) => (
            <button key={sp} className={`speed ${s.speed === sp ? 'active' : ''}`} onClick={() => send({ type: 'SET_SPEED', speed: sp })} title={label} aria-label={label}>
              <Icon name={icon} size={16} fill />
              {sp >= 5 && <span className="speed-n">{sp}</span>}
            </button>
          ))}
        </div>
        <button className="icon-btn" onClick={() => setView('settings')} title="Paramètres" aria-label="Paramètres">
          <Icon name="cog" size={22} />
        </button>
      </div>
    </header>
  );
}
