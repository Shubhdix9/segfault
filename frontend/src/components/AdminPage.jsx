import CampaignReceipt from './CampaignReceipt.jsx';

function short(address) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function Gate({ title, message, account, onConnect }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p className="sub">{message}</p>
      {!account && <button className="btn go" onClick={onConnect}>Connect wallet</button>}
    </div>
  );
}

function Summary({ items }) {
  return (
    <div className="big">
      {items.map(([value, label]) => (
        <div key={label}><b>{value}</b><span>{label}</span></div>
      ))}
    </div>
  );
}

export default function AdminPage({ account, ngos, campaigns, isAdmin, onConnect, onNgoStatus, onPause }) {
  if (!account) {
    return <Gate title="Admin dashboard" message="Connect the platform admin wallet." onConnect={onConnect} />;
  }
  if (!isAdmin) {
    return <Gate title="Admin dashboard" message="This wallet isn’t the platform admin, so there is nothing to show." account={account} onConnect={onConnect} />;
  }

  const raised = campaigns.reduce((sum, campaign) => sum + campaign.raised, 0);
  const flags = campaigns.flatMap((campaign) => campaign.ms
    .filter((milestone) => milestone.st === 'voting' && milestone.no > milestone.yes)
    .map((milestone) => ({ campaign, milestone })));

  return (
    <>
      <h2>Admin dashboard</h2>
      <p className="sub">Platform oversight. Admins verify NGOs and can pause a campaign. They can’t move donor funds or vote on receipts.</p>
      <Summary items={[
        [ngos.filter((ngo) => ngo.st === 'approved').length, 'verified NGOs'],
        [campaigns.length, 'campaigns'],
        [raised, 'POL raised'],
        [flags.length, 'flagged by donors'],
      ]} />
      <div className="rack">
        <article className="rcpt">
          <h3>NGO applications</h3>
          <div className="by">Only verified NGOs can start campaigns</div>
          {ngos.map((ngo, index) => (
            <div key={ngo.name}>
              <div className="ln"><span>{ngo.name}</span><i /><span>{ngo.w}</span></div>
              {ngo.st === 'pending' ? (
                <div className="admin-actions">
                  <button className="btn yes" onClick={() => onNgoStatus(index, 'approved')}>Verify</button>
                  <button className="btn no" onClick={() => onNgoStatus(index, 'rejected')}>Reject</button>
                </div>
              ) : (
                <div className="text-right">
                  <span className={`stamp ${ngo.st === 'approved' ? 'ok' : ''}`}>
                    {ngo.st === 'approved' ? 'VERIFIED' : 'REJECTED'}
                  </span>
                </div>
              )}
            </div>
          ))}
        </article>
        <article className="rcpt">
          <h3>All campaigns</h3>
          <div className="by">Raised, in POL</div>
          {campaigns.map((campaign) => (
            <div key={campaign.id}>
              <div className="ln"><span>#{campaign.id} {campaign.title}</span><i /><span>{campaign.raised}</span></div>
              <div className="text-right">
                {campaign.paused && <><span className="stamp">PAUSED</span>{' '}</>}
                <button className="pause-button" onClick={() => onPause(campaign.id)}>
                  {campaign.paused ? 'Resume' : 'Pause'}
                </button>
              </div>
            </div>
          ))}
          <div className="tot"><span>TOTAL</span><span>{raised} POL</span></div>
        </article>
        <article className="rcpt">
          <h3>Flagged by donors</h3>
          <div className="by">Milestones where no votes lead</div>
          {flags.length ? flags.map(({ campaign, milestone }) => (
            <div key={`${campaign.id}-${milestone.n}`}>
              <div className="ln"><span>{campaign.title}: {milestone.n}</span><i /><span>{milestone.no} no</span></div>
              <div className="stub flag-note">NGO: {campaign.ngo}</div>
            </div>
          )) : <div className="stub">Nothing flagged right now.</div>}
        </article>
      </div>
    </>
  );
}
