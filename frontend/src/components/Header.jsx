function short(address) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function Header({ account, demo, onConnect, onEnterDemo, onLogout, showDemoOption }) {
  const activeView = window.location.hash.slice(1) || 'explore';

  return (
    <header>
      <a className="logo" href="#explore">WellChain</a>
      <nav aria-label="Main">
        <a href="#explore" aria-current={activeView === 'explore' ? 'page' : undefined}>Campaigns</a>
        <a href="#portfolio" aria-current={activeView === 'portfolio' ? 'page' : undefined}>Donor</a>
        <a href="#ngo" aria-current={activeView === 'ngo' ? 'page' : undefined}>NGO</a>
        <a href="#admin" aria-current={activeView === 'admin' ? 'page' : undefined}>Admin</a>
      </nav>
      <div className="header-actions">
        {account ? (
          <>
            <span className="wallet-chip" title={account}>
              {short(account)}{demo ? ' (demo)' : ''}
            </span>
            <button className="btn no logout-btn" onClick={onLogout} type="button">
              {demo ? 'Exit demo' : 'Disconnect'}
            </button>
          </>
        ) : (
          <>
            <button className="btn go" onClick={onConnect} type="button">
              Connect wallet
            </button>
            {showDemoOption && (
              <button className="btn logout-btn" onClick={onEnterDemo} type="button">
                Demo mode
              </button>
            )}
          </>
        )}
      </div>
    </header>
  );
}
