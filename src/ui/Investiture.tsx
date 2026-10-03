import { useEffect, useMemo, useState } from 'react';
import { send, useGame } from '../game/store';
import { OPENING_STORY } from '../sim/data/opening';
import { TRAIT_LABELS } from '../sim/data/world';
import type { CitizenId, OfficeId, OpeningCandidateView, OpeningView } from '../sim/types';
import { Bar, Portrait } from './common';

// Investiture : premier acte du nouveau DSI. Pour chaque siège, trois habitants ;
// le maire est élu (la DSI peut peser discrètement), le juge, le shérif et le chef des fournitures sont nommés.

type Seat = OpeningView['seats'][number];

const STATS: { key: keyof OpeningCandidateView; label: string; tip: string }[] = [
  { key: 'skill', label: 'Compétence', tip: 'Qualité du travail dans la fonction.' },
  { key: 'leadership', label: 'Leadership', tip: 'Capacité à entraîner, à rassurer, à tenir un étage.' },
  { key: 'integrity', label: 'Intégrité ~', tip: 'Estimation de la DSI : les dossiers ne sont pas exacts.' },
  { key: 'popularity', label: 'Popularité', tip: 'Poids auprès des habitants (et des électeurs).' },
  { key: 'loyalty', label: 'Loyauté DSI', tip: 'Confiance envers vous. Un titulaire méfiant vous contredira au conseil.' },
  { key: 'ambition', label: 'Ambition', tip: 'Un ambitieux voudra davantage que son siège.' },
];

export function Investiture({ name, awaitingNew, onDone }: { name: string; awaitingNew: boolean; onDone: () => void }) {
  const opening = useGame((g) => g.snapshot?.opening);
  const [step, setStep] = useState(0); // 0 : récit · 1..n : sièges · n+1 : résultats
  const [picks, setPicks] = useState<Partial<Record<OfficeId, CitizenId>>>({});
  const [backed, setBacked] = useState<Partial<Record<OfficeId, CitizenId | null>>>({});
  const [sealed, setSealed] = useState(false);
  const pending = opening?.status === 'pending';
  const signature = opening?.seats.map((s) => s.candidates.map((c) => c.id).join('.')).join('|') ?? '';

  // Pas d'investiture à faire (partie déjà commencée) : on passe, après avoir laissé le temps à une nouvelle partie d'arriver.
  useEffect(() => {
    if (pending || sealed) return;
    const t = setTimeout(onDone, awaitingNew ? 2500 : 1200);
    return () => clearTimeout(t);
  }, [pending, sealed, awaitingNew]);

  // Choix par défaut : les favoris proposés par la DSI.
  useEffect(() => {
    if (!opening || !pending) return;
    const p: Partial<Record<OfficeId, CitizenId>> = {};
    for (const s of opening.seats) if (s.chosenId !== undefined) p[s.officeId] = s.chosenId;
    setPicks(p);
    setBacked({});
  }, [signature]);

  if (!opening || (!pending && !sealed)) return null;
  const seats = opening.seats;
  const seat = step >= 1 && step <= seats.length ? seats[step - 1] : undefined;

  const seal = () => {
    send({ type: 'INVESTITURE', picks, backed });
    setSealed(true);
    setStep(seats.length + 1);
  };

  return (
    <div className="investiture">
      {step === 0 && (
        <div className="inv-story" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}assets/rooms/servers.png)` }}>
          <div className="inv-story-text">
            <p className="inv-kicker">Jour 1, 05:40 — salle des serveurs, niveau -03</p>
            <h1>Investiture</h1>
            {OPENING_STORY.paragraphs.map((p, i) => (
              <p key={i} className="prologue-line" style={{ animationDelay: `${0.3 + i * 0.9}s` }}>
                {p}
              </p>
            ))}
            <p className="prologue-line inv-you" style={{ animationDelay: `${0.3 + OPENING_STORY.paragraphs.length * 0.9}s` }}>
              {name}, vous avez quatre sièges à pourvoir avant que la cloche de six heures ne sonne.
            </p>
            <div className="row gap inv-actions">
              <button className="pact-btn" onClick={() => setStep(1)}>
                Ouvrir les dossiers
              </button>
              <button className="link small" onClick={seal} title="Les favoris de la DSI sont confirmés, l'élection se tient sans votre soutien.">
                Confirmer les favoris sans lire
              </button>
            </div>
          </div>
        </div>
      )}
      {seat && (
        <SeatPage
          seat={seat}
          index={step}
          count={seats.length}
          pick={picks[seat.officeId]}
          backedId={backed[seat.officeId] ?? null}
          onPick={(id) => setPicks({ ...picks, [seat.officeId]: id })}
          onBack={(id) => setBacked({ ...backed, [seat.officeId]: id })}
          onPrev={() => setStep(step - 1)}
          onNext={() => (step < seats.length ? setStep(step + 1) : seal())}
        />
      )}
      {step === seats.length + 1 && <Results opening={opening} onDone={onDone} />}
    </div>
  );
}

function SeatPage({
  seat,
  index,
  count,
  pick,
  backedId,
  onPick,
  onBack,
  onPrev,
  onNext,
}: {
  seat: Seat;
  index: number;
  count: number;
  pick?: CitizenId;
  backedId: CitizenId | null;
  onPick: (id: CitizenId) => void;
  onBack: (id: CitizenId | null) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const election = seat.mode === 'election';
  return (
    <div className="inv-seat" key={seat.officeId}>
      <header className="inv-head">
        <div className="muted small">
          Siège {index} sur {count} · {election ? 'Élection — mandat de deux ans' : 'Nomination par la DSI'}
        </div>
        <h2>{seat.title}</h2>
        <p>{seat.role}</p>
        <p className="small muted">
          <strong>Ce qui en dépendra :</strong> {seat.weighs}
        </p>
        {election && (
          <p className="small inv-note">
            Le silo vote. Vous pouvez peser en silence — consignes aux responsables d’étage, temps de parole au réfectoire. Votre soutien vaut environ <strong>+{seat.backingBonus ?? 10} points</strong> d’intentions de vote, ne garantit rien, et peut se savoir.
          </p>
        )}
      </header>
      <div className="inv-cands">
        {seat.candidates.map((c) => {
          const selected = election ? backedId === c.id : pick === c.id;
          return (
            <article key={c.id} className={`card inv-cand ${selected ? 'selected' : ''}`}>
              <div className="row gap">
                <Portrait portrait={c.portrait} sector={c.sector} look={c.look} size={64} />
                <div className="grow">
                  <div className="inv-arch">{c.archetypeLabel}{c.incumbent ? ' · titulaire' : ''}</div>
                  <strong className="inv-name">{c.name}</strong>
                  <div className="small muted">
                    {c.age} ans · {c.sectorName}
                  </div>
                  <div className="traits">
                    {c.traits.map((t) => (
                      <span key={t} className="tag">
                        {TRAIT_LABELS[t]}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="inv-stats">
                {STATS.map((st) => (
                  <div key={st.key} className="inv-stat" title={st.tip}>
                    <span className="muted small">{st.label}</span>
                    <Bar value={c[st.key] as number} color={st.key === 'ambition' ? 'var(--orange)' : st.key === 'loyalty' ? 'var(--info)' : undefined} />
                    <span className="small">{c[st.key] as number}</span>
                  </div>
                ))}
              </div>
              <p className="inv-bio">{c.bio}</p>
              <p className="inv-file">
                <span className="muted tiny">Dossier DSI — </span>
                {c.file}
              </p>
              {c.pledge && <p className="small inv-pledge">Promet : « {c.pledge} »</p>}
              {election && c.poll !== undefined && (
                <div className="inv-poll">
                  <span className="small muted">Intentions de vote</span>
                  <Bar value={c.poll} color="var(--accent)" />
                  <span className="small">{c.poll} %</span>
                </div>
              )}
              <button className={`btn ${selected ? 'active' : ''}`} onClick={() => (election ? onBack(selected ? null : c.id) : onPick(c.id))}>
                {election ? (selected ? 'Soutenu·e en silence' : 'Soutenir discrètement') : selected ? (c.incumbent ? 'Maintenu·e' : 'Retenu·e') : c.incumbent ? 'Maintenir' : 'Nommer'}
              </button>
            </article>
          );
        })}
      </div>
      <footer className="row between inv-foot">
        <button className="btn" onClick={onPrev}>
          ← {index === 1 ? 'Le récit' : 'Siège précédent'}
        </button>
        {election && (
          <button className={`btn ${backedId === null ? 'active' : ''}`} onClick={() => onBack(null)} title="Une élection sans consigne est plus légitime.">
            Élection libre : ne soutenir personne
          </button>
        )}
        <button className="btn primary" onClick={onNext}>
          {index < count ? 'Siège suivant →' : 'Sceller l’investiture'}
        </button>
      </footer>
    </div>
  );
}

function Results({ opening, onDone }: { opening: OpeningView; onDone: () => void }) {
  const done = opening.status === 'done';
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setShown(true), 80);
    return () => clearTimeout(t);
  }, [done]);
  const mayor = opening.seats.find((s) => s.mode === 'election');
  const winner = useMemo(() => mayor?.candidates.find((c) => c.id === mayor.chosenId), [mayor]);
  if (!done) return <div className="inv-seat"><p className="muted">Dépouillement en cours…</p></div>;
  return (
    <div className="inv-seat inv-results">
      <header className="inv-head">
        <div className="muted small">Jour 1, 06:00 — la cloche sonne</div>
        <h2>Le silo a un gouvernement</h2>
      </header>
      {mayor && (
        <div className="card">
          <h3>Élection du maire</h3>
          {[...mayor.candidates].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0)).map((c) => (
            <div key={c.id} className={`row gap inv-vote ${c.id === mayor.chosenId ? 'won' : ''}`}>
              <Portrait portrait={c.portrait} sector={c.sector} look={c.look} size={34} />
              <span className="grow">
                {c.name} {c.id === mayor.chosenId && <span className="tag ok">élu·e</span>} {c.id === mayor.backedId && <span className="tag">soutenu·e par la DSI</span>}
              </span>
              <div style={{ width: 160 }}>
                <Bar value={shown ? (c.votes ?? 0) : 0} color={c.id === mayor.chosenId ? 'var(--ok)' : 'var(--accent)'} height={8} />
              </div>
              <span className="small">{c.votes ?? 0} %</span>
            </div>
          ))}
          {mayor.backedId !== undefined && mayor.backedId !== mayor.chosenId && <p className="small warn">Votre candidat·e a perdu. Le nouveau maire le sait.</p>}
          {mayor.backedId !== undefined && mayor.backedId === mayor.chosenId && <p className="small muted">Votre consigne a porté. {winner?.name} le sait — et vous le doit.</p>}
          {mayor.backedId === undefined && <p className="small muted">Élection libre : le maire ne vous doit rien, et le silo le sait. Sa légitimité en sort grandie.</p>}
          {mayor.leaked && <p className="small bad">Votre soutien a été éventé : on parle déjà d’élection arrangée.</p>}
          {winner?.pledge && <p className="small">Promesse de campagne : « {winner.pledge} ». Le silo s’en souviendra.</p>}
        </div>
      )}
      <div className="inv-appointees">
        {opening.seats
          .filter((s) => s.mode !== 'election')
          .map((s) => {
            const c = s.candidates.find((x) => x.id === s.chosenId);
            if (!c) return null;
            return (
              <div key={s.officeId} className="card row gap">
                <Portrait portrait={c.portrait} sector={c.sector} look={c.look} size={44} />
                <div>
                  <div className="muted small">{s.title}</div>
                  <strong>{c.name}</strong>
                  <div className="small muted">{c.archetypeLabel}</div>
                </div>
              </div>
            );
          })}
      </div>
      <p className="small muted">Chacun a ses forces, ses failles — et parfois un secret que vos dossiers n’ont pas trouvé. Vous le découvrirez à l’usage.</p>
      <footer className="row between inv-foot">
        <span />
        <button className="btn primary" onClick={onDone}>
          Prendre ses fonctions
        </button>
      </footer>
    </div>
  );
}
