import { useState } from 'react';
import { getIPFSUrl } from '../services/ipfs.js';

function short(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function NgoApplicationForm({ account, existingApplication, onSubmit, demo }) {
  const [name, setName] = useState(existingApplication?.name || '');
  const [goals, setGoals] = useState(existingApplication?.goals || '');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!name.trim() || !goals.trim()) return;
    if (!file && !existingApplication?.docName) return;

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        goals: goals.trim(),
        file,
      });
      setFile(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <article className="rcpt application-card">
      <div className="ln">
        <h3>NGO Verification Application</h3>
        {existingApplication?.st === 'pending' && <span className="stamp">PENDING</span>}
        {existingApplication?.st === 'rejected' && <span className="stamp no">REJECTED</span>}
      </div>
      <div className="by">
        {existingApplication?.st === 'pending'
          ? `Application submitted for ${short(account)}. You can update your submission below.`
          : existingApplication?.st === 'rejected'
            ? 'Your previous application was disapproved. Submit updated credentials and documents to reapply.'
            : `Wallet ${short(account)}. Submit your NGO credentials for platform administrator review.`}
      </div>

      {existingApplication && (
        <div className="app-status-callout">
          <div className="callout-header">
            <b>Current Status: {existingApplication.st === 'pending' ? 'Pending Admin Review' : 'Disapproved'}</b>
          </div>
          <div className="callout-body">
            <div><b>Submitted Organization:</b> {existingApplication.name}</div>
            {existingApplication.docCid ? (
              <div>
                <b>Attached Document:</b>{' '}
                <a
                  href={getIPFSUrl(existingApplication.docCid)}
                  target="_blank"
                  rel="noreferrer"
                  className="doc-ipfs-link"
                >
                  📄 {existingApplication.docName || 'View document on IPFS'} ↗
                </a>
              </div>
            ) : existingApplication.docName ? (
              <div>
                <b>Attached Document:</b> 📄 {existingApplication.docName}
              </div>
            ) : null}
          </div>
          {demo && existingApplication.st === 'pending' && (
            <p className="callout-hint">
              💡 Presentation hint: Switch to the <b>Platform admin</b> role in the top console to approve or disapprove this application.
            </p>
          )}
        </div>
      )}

      <form className="ngo-apply-form" onSubmit={handleSubmit}>
        <label>
          Organization Name
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Tankaa Foundation"
          />
        </label>

        <label>
          Mission & Goals
          <textarea
            required
            rows="4"
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            placeholder="Describe your organization's mission, impact goals, and how you will execute projects..."
          />
        </label>

        <label>
          Verification Document (PDF or Photo)
          <div className="stub proof-note">
            Upload registration certificate, tax exemption (e.g. 501c3), or audit statement. Pinned to IPFS for administrator review.
          </div>
          <input
            type="file"
            accept=".pdf,image/*"
            required={!existingApplication?.docName}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          {existingApplication?.docName && !file && (
            <small className="file-hint">Current file on record: {existingApplication.docName}</small>
          )}
        </label>

        <button className="btn go publish-button" type="submit" disabled={submitting}>
          {submitting
            ? 'Uploading to IPFS...'
            : existingApplication
              ? 'Update & Re-submit application'
              : 'Submit NGO application'}
        </button>
      </form>
    </article>
  );
}
