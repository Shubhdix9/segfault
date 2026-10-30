import CampaignReceipt from './CampaignReceipt.jsx';
import CampaignForm from './CampaignForm.jsx';

function short(address) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
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

function Gate({ onConnect }) {
  return (
    <div className="empty">
      <h2>NGO dashboard</h2>
      <p className="sub">Connect the wallet your NGO registered with to run campaigns and submit receipts.</p>
      <button className="btn go" onClick={onConnect}>Connect wallet</button>
    </div>
  );
}

export default function NgoPage({ account, demo, campaigns, onConnect, onProof, onClaim, onPublish }) {
  if (!account) return <Gate onConnect={onConnect} />;

  const ownedCampaigns = campaigns.filter((campaign) => campaign.own);
  const raised = ownedCampaigns.reduce((sum, campaign) => sum + campaign.raised, 0);
  const receiptsDue = ownedCampaigns.reduce((sum, campaign) => (
    sum + campaign.ms.filter((milestone) => milestone.st === 'pending').length
  ), 0);
  const inVote = ownedCampaigns.reduce((sum, campaign) => (
    sum + campaign.ms.filter((milestone) => milestone.st === 'voting').length
  ), 0);

  return (
    <>
      <h2>NGO dashboard</h2>
      <p className="sub">Wallet {short(account)}{demo ? ' (demo data)' : ''}. Each payout stays locked until your donors approve its receipt.</p>
      <Summary items={[
        [ownedCampaigns.length, 'campaigns'],
        [raised, 'POL raised'],
        [receiptsDue, 'receipts to submit'],
        [inVote, 'in donor vote'],
      ]} />
      <div className="rack">
        {ownedCampaigns.length ? ownedCampaigns.map((campaign) => {
          const pendingIndex = campaign.ms.findIndex((milestone) => milestone.st === 'pending');
          const pendingMilestone = pendingIndex >= 0 ? campaign.ms[pendingIndex] : null;
          const votingIndex = campaign.ms.findIndex((milestone) => milestone.st === 'voting');
          const votingMilestone = votingIndex >= 0 ? campaign.ms[votingIndex] : null;

          return (
            <CampaignReceipt key={campaign.id} campaign={campaign}>
              {pendingMilestone?.seed && (
                <div className="vbox">
                  <strong>Seed advance</strong>
                  <div className="stub vbox-note">Unlocks once {pendingMilestone.amt} POL is raised. Now at {campaign.raised}.</div>
                  <button className="btn go" onClick={() => onClaim(campaign.id, pendingIndex)}>Claim seed advance</button>
                </div>
              )}
              {pendingMilestone && !pendingMilestone.seed && (
                <div className="vbox">
                  <strong>Next payout: {pendingMilestone.n}</strong>
                  <div className="stub proof-note">Upload the store receipt. Donors then vote for 24 hours.</div>
                  <input
                    id={`pf${campaign.id}-${pendingIndex}`}
                    type="file"
                    accept="image/*,.pdf"
                    aria-label="Receipt file"
                  />
                  <button
                    className="btn go"
                    onClick={() => onProof(
                      campaign.id,
                      pendingIndex,
                      document.getElementById(`pf${campaign.id}-${pendingIndex}`)?.files?.[0],
                    )}
                  >
                    Submit receipt
                  </button>
                </div>
              )}
              {votingMilestone && (
                <div className="vbox">
                  <strong>Donors are voting on {votingMilestone.n}</strong>
                  <div className="stub vbox-note">
                    {votingMilestone.yes} yes, {votingMilestone.no} no, by weight. A payout needs more than {Math.floor(campaign.raised / 2)} yes.
                  </div>
                </div>
              )}
            </CampaignReceipt>
          );
        }) : <p className="empty">No campaigns yet. Start one below.</p>}
      </div>
      <div className="campaign-create"><CampaignForm onPublish={onPublish} /></div>
    </>
  );
}
