import { send } from '../game/store';

// Outils de test, visibles avec ?debug dans l'URL.
export function DebugPanel() {
  const ev = (eventId: string, floor?: string) => send({ type: 'SPAWN_EVENT', eventId, floor });
  return (
    <div className="debug-panel">
      <strong className="small">DEBUG</strong>
      <button className="btn small" onClick={() => send({ type: 'DEBUG', action: 'fail', target: 'generator' })}>
        Panne génératrice
      </button>
      <button className="btn small" onClick={() => send({ type: 'DEBUG', action: 'fail', target: 'pump_main' })}>
        Panne pompe
      </button>
      <button className="btn small" onClick={() => send({ type: 'DEBUG', action: 'accident' })}>
        Accident minier
      </button>
      <button className="btn small" onClick={() => send({ type: 'DEBUG', action: 'unrest', target: 'res_mid' })}>
        Colère -05
      </button>
      <button className="btn small" onClick={() => ev('wants_out')}>
        « Je veux sortir »
      </button>
      <button className="btn small" onClick={() => ev('surface_rumor')}>
        Rumeur
      </button>
      <button className="btn small" onClick={() => send({ type: 'DEBUG', action: 'faction' })}>
        Faction (mines)
      </button>
      <button className="btn small" onClick={() => send({ type: 'DEBUG', action: 'rumor' })}>
        Rumeur fausse
      </button>
      <button className="btn small" onClick={() => send({ type: 'DEBUG', action: 'arrest' })}>
        Arrestation
      </button>
      <button className="btn small" onClick={() => send({ type: 'DEBUG', action: 'year' })}>
        Fin d’année
      </button>
      <button className="btn small" onClick={() => send({ type: 'DEBUG', action: 'victory' })}>
        Fin de mandat
      </button>
      <button className="btn small" onClick={() => send({ type: 'DEBUG', action: 'resources' })}>
        Stocks pleins
      </button>
    </div>
  );
}
