import React, { useState } from 'react';
import './App.css';
import { connectWallet, isMetaMaskInstalled } from './utils/ethereum';
import { isSupabaseConfigured } from './services/supabase';

function App() {
  const [account, setAccount] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    setIsConnecting(true);
    setError('');
    try {
      const data = await connectWallet();
      setAccount(data.account);
    } catch (err) {
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <div>
          <span className="logo-badge">SegFault Charity Platform</span>
          <h1 className="title">SegFault</h1>
          <p className="subtitle">
            Blockchain-based milestone charity donation platform with publicly verifiable transactions
          </p>
        </div>

        <div>
          {account ? (
            <div className="wallet-connected">
              🟢 Connected: {account.slice(0, 6)}...{account.slice(-4)}
            </div>
          ) : (
            <button
              className="wallet-btn"
              onClick={handleConnect}
              disabled={isConnecting}
            >
              {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
            </button>
          )}
        </div>
      </header>

      {error && (
        <div style={{ color: '#ef4444', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          ⚠️ {error}
        </div>
      )}

      <main className="grid">
        <section className="card">
          <h3>Smart Contracts</h3>
          <p>
            Hardhat environment configured with OpenZeppelin contracts and milestone release verification.
          </p>
          <span className="status-pill ready">Ready & Compiled</span>
        </section>

        <section className="card">
          <h3>Supabase Backend</h3>
          <p>
            Off-chain campaign metadata, milestone progress, and donor analytics database layer.
          </p>
          <span className={`status-pill ${isSupabaseConfigured() ? 'ready' : 'pending'}`}>
            {isSupabaseConfigured() ? 'Configured' : 'Needs .env Config'}
          </span>
        </section>

        <section className="card">
          <h3>Web3 Frontend</h3>
          <p>
            React + Vite interface integrating MetaMask wallet provider and ethers.js interactions.
          </p>
          <span className="status-pill ready">Initialized</span>
        </section>
      </main>

      <footer className="footer">
        SegFault &copy; {new Date().getFullYear()} — Transparent, milestone-driven blockchain philanthropy.
      </footer>
    </div>
  );
}

export default App;

