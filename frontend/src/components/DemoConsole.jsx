import { demoActors } from '../data/WellChain.js';

const roles = Object.entries(demoActors);

function storageLabel(storage) {
  if (!storage?.online) return 'Upload API offline';
  if (!storage.pinataConfigured) return 'Pinata not configured';
  return storage.storageMode === 'pinata' ? 'Pinata IPFS live' : 'Mock IPFS storage';
}

export default function DemoConsole({ account, onRoleChange, onReset, onRefreshStorage, storage }) {
  const activeRole = roles.find(([, actor]) => actor.address.toLowerCase() === account?.toLowerCase())?.[0];
  const storageIsLive = storage?.online && storage.pinataConfigured && storage.storageMode === 'pinata';

  return (
    <section className="demo-console" aria-label="Presentation controls">
      <div className="demo-console-heading">
        <div>
          <span className="demo-kicker">PRESENTATION MODE</span>
          <h2>Run the whole story. Spend nothing.</h2>
          <p>Switch roles as you present. POL amounts are simulated; JSON and receipt uploads use the configured IPFS service.</p>
        </div>
        <div className="demo-statuses">
          <span className="demo-badge fake-pol">SIMULATED POL · NO GAS</span>
          <span className={`demo-badge ${storageIsLive ? 'ipfs-live' : 'ipfs-mock'}`}>
            <i aria-hidden="true" />{storageLabel(storage)}
          </span>
          <button className="storage-refresh" type="button" onClick={onRefreshStorage}>Check IPFS setup</button>
        </div>
      </div>

      <p className="storage-explainer">
        {storageIsLive
          ? 'Campaign JSON and receipt files are pinned to Pinata, then read back by CID.'
          : storage?.online
            ? 'The upload API is reachable, but this is temporary mock storage—not public IPFS.'
            : 'Start the backend and set PINATA_MODE=pinata plus PINATA_JWT in backend/.env for real IPFS.'}
      </p>

      <div className="demo-controls">
        <div className="role-switch" role="group" aria-label="Choose a demo role">
          {roles.map(([role, actor]) => (
            <button
              className={`role-button ${activeRole === role ? 'active' : ''}`}
              key={role}
              type="button"
              aria-pressed={activeRole === role}
              onClick={() => onRoleChange(actor.address)}
            >
              <span>{actor.label}</span>
              <small>{actor.address.slice(0, 6)}…{actor.address.slice(-4)}</small>
            </button>
          ))}
        </div>
        <button className="demo-reset" type="button" onClick={onReset}>Reset demo</button>
      </div>

      <ol className="demo-journey">
        <li><a href="#explore"><b>01</b><span>Fund a project</span></a></li>
        <li><a href="#ngo"><b>02</b><span>Post receipt & IPFS proof</span></a></li>
        <li><a href="#portfolio"><b>03</b><span>Vote as a donor</span></a></li>
        <li><a href="#admin"><b>04</b><span>Manage NGO access</span></a></li>
      </ol>
    </section>
  );
}
