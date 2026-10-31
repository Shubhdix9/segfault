import NgoApplicationForm from './NgoApplicationForm.jsx';
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

export default function NgoPage({
  account,
  demo,
  campaigns,
  ngos = [],
  onConnect,
  onProof,
  onClaim,
  onPublish,
  onApplyNgo,
  isVerifiedNgo,
}) {
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
      <p className="sub">
        Wallet {short(account)}{demo ? ' (presentation role)' : ''}. Each payout stays locked until donors approve its receipt.
        {demo && ' POL and payouts are simulated; uploaded campaign and proof documents use IPFS storage.'}
      </p>
      <Summary items={[
        [ownedCampaigns.length, 'campaigns'],
        [raised, demo ? 'simulated POL raised' : 'POL raised'],
        [receiptsDue, 'receipts to submit'],
        [inVote, 'in donor vote'],
      ]} />
      <div className="rack">
        {ownedCampaigns.length ? ownedCampaigns.map((campaign) => {
          const pendingArrayIndex = campaign.ms.findIndex((milestone) => milestone.st === 'pending');
          const pendingMilestone = pendingArrayIndex >= 0 ? campaign.ms[pendingArrayIndex] : null;
          const pendingIndex = pendingMilestone
            ? pendingMilestone.index ?? pendingArrayIndex
            : -1;
          const votingIndex = campaign.ms.findIndex((milestone) => milestone.st === 'voting');
          const votingMilestone = votingIndex >= 0 ? campaign.ms[votingIndex] : null;

          return (
            <CampaignReceipt key={campaign.id} campaign={campaign}>
              {campaign.seedAdvancePct > 0 && (
                <div className="vbox">
                  <strong>{campaign.seedClaimed ? 'Seed advance claimed' : 'Seed advance'}</strong>
                  <div className="stub vbox-note">
                    {campaign.seedClaimed
                      ? `${campaign.seedAdvancePct}% advance has been claimed.`
                      : `Unlocks once ${campaign.seedAmount} POL is raised. Now at ${campaign.raised}.`}
                  </div>
                  {!campaign.seedClaimed && (
                    <button
                      className="btn go"
                      disabled={campaign.canClaimSeed !== undefined ? !campaign.canClaimSeed : campaign.raised < campaign.seedAmount}
                      onClick={() => onClaim(campaign.id)}
                    >
                      Claim seed advance
                    </button>
                  )}
                </div>
              )}
              {pendingMilestone?.seed && campaign.seedAdvancePct === undefined && (
                <div className="vbox">
                  <strong>Seed advance</strong>
                  <div className="stub vbox-note">Unlocks once {pendingMilestone.amt} POL is raised. Now at {campaign.raised}.</div>
                  <button className="btn go" onClick={() => onClaim(campaign.id, pendingIndex)}>Claim seed advance</button>
                </div>
              )}
              {pendingMilestone && !pendingMilestone.seed && (
                <div className="vbox">
                  <strong>Next payout: {pendingMilestone.n}</strong>
                  <div className="stub proof-note">
                    {demo
                      ? 'Upload the store receipt and proof JSON to IPFS. Donor votes and payouts are simulated.'
                      : 'Upload the store receipt and proof JSON to IPFS. Donors then vote for 24 hours.'}
                  </div>
                  <input
                    id={`pf${campaign.id}-${pendingIndex}`}
                    type="file"
                    accept="image/*,.pdf"
                    aria-label="Receipt file"
                  />
                  <button
                    className="btn go"
                    onClick={(event) => {
                      const file = event.currentTarget.parentElement.querySelector('input[type="file"]')?.files?.[0];
                      onProof(campaign.id, pendingIndex, file);
                    }}
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
      {!isVerifiedNgo ? (
        <div className="campaign-create">
          <NgoApplicationForm
            account={account}
            existingApplication={ngos.find((n) => n.w?.toLowerCase() === account?.toLowerCase())}
            onSubmit={onApplyNgo}
            demo={demo}
          />
        </div>
      ) : (
        <div className="campaign-create"><CampaignForm onPublish={onPublish} /></div>
      )}
    </>
  );
}
