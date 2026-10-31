import CampaignReceipt from './CampaignReceipt.jsx';
import { useEffect, useState } from 'react';
import { getIPFSUrl } from '../services/ipfs.js';

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

export default function PortfolioPage({
  account,
  demo,
  campaigns,
  votes,
  onConnect,
  onVote,
  onFinalize,
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  if (!account) {
    return (
      <div className="empty">
        <h2>Donor dashboard</h2>
        <p className="sub">Connect your wallet to see which campaigns you back and which receipts are waiting for your vote.</p>
        <button className="btn go" onClick={onConnect}>Connect wallet</button>
      </div>
    );
  }

  const mine = campaigns.filter((campaign) => campaign.mine > 0);
  const total = mine.reduce((sum, campaign) => sum + campaign.mine, 0);
  const pending = mine.reduce((sum, campaign) => (
    sum + campaign.ms.filter((milestone, index) => (
      milestone.st === 'voting'
      && votes[`${campaign.id}-${milestone.index ?? index}`] === undefined
    )).length
  ), 0);

  return (
    <>
      <h2>Donor dashboard</h2>
      <p className="sub">Wallet {short(account)}{demo ? ' (demo data)' : ''}</p>
      <Summary items={[
        [total, demo ? 'simulated POL given' : 'POL given'],
        [mine.length, 'campaigns backed'],
        [Object.keys(votes).length, 'votes cast'],
        [pending, 'waiting on you'],
      ]} />
      <div className="rack">
        {mine.length ? mine.map((campaign) => {
          const arrayIndex = campaign.ms.findIndex((item) => item.st === 'voting');
          const milestone = arrayIndex >= 0 ? campaign.ms[arrayIndex] : null;
          const milestoneIndex = milestone ? milestone.index ?? arrayIndex : -1;
          const voted = milestone ? votes[`${campaign.id}-${milestoneIndex}`] : undefined;
          const receiptCid = milestone?.receiptCid || milestone?.proofCid;
          const proofUrl = receiptCid ? getIPFSUrl(receiptCid) : '';
          const proofMetadataUrl = milestone?.proofIsMetadata && milestone?.proofCid
            ? getIPFSUrl(milestone.proofCid)
            : '';
          const totalVotes = milestone ? milestone.yes + milestone.no : 0;
          const yesPercent = totalVotes ? Math.round((milestone.yes / totalVotes) * 100) : 0;
          const votingExpired = !demo && milestone?.deadline > 0
            && now > (milestone.deadline + 3) * 1000;

          return (
            <CampaignReceipt key={campaign.id} campaign={campaign}>
              <div className="stub">You gave {campaign.mine} POL, {Math.round((campaign.mine / campaign.raised) * 100)}% of this campaign.</div>
              {milestone && (
                <div className="vbox">
                  <strong>Receipt for “{milestone.n}”</strong><br />
                  {proofUrl ? (
                    <a href={proofUrl} target="_blank" rel="noopener noreferrer">
                      Open receipt on IPFS ↗
                    </a>
                  ) : milestone.proofName ? (
                    <span className="stub">Demo attachment: {milestone.proofName} (not uploaded)</span>
                  ) : <span className="stub">No receipt attachment is available.</span>}
                  {proofMetadataUrl && (
                    <a href={proofMetadataUrl} target="_blank" rel="noopener noreferrer">
                      Open proof JSON ↗
                    </a>
                  )}
                  <div className="tally" aria-hidden="true">
                    <i style={{ width: `${yesPercent}%`, background: '#7fd6a6' }} />
                    <i style={{ width: `${100 - yesPercent}%`, background: '#ff9d86' }} />
                  </div>
                  <div className="stub compact">
                    {totalVotes ? `${yesPercent}% yes, ${100 - yesPercent}% no. ` : 'No votes yet. '}
                    Your vote weighs {campaign.mine}.
                  </div>
                  {votingExpired && (
                    <button className="btn go finalize-button" onClick={() => onFinalize(campaign.id, milestoneIndex)}>
                      Finalize milestone
                    </button>
                  )}
                  {demo && milestone.st === 'voting' && (
                    <button className="btn go finalize-button" onClick={() => onFinalize(campaign.id, milestoneIndex)}>
                      Finalize simulated vote
                    </button>
                  )}
                  {voted === undefined ? (
                    votingExpired
                      ? <p className="vote-result"><strong>Voting has closed. Anyone can finalize this milestone.</strong></p>
                      : (
                        <div className="vote-actions">
                          <button className="btn yes" onClick={() => onVote(campaign.id, milestoneIndex, true)}>Receipt is real, pay out</button>
                          <button className="btn no" onClick={() => onVote(campaign.id, milestoneIndex, false)}>Reject and flag fraud</button>
                        </div>
                      )
                  ) : (
                    <p className="vote-result"><strong>{voted === 'cast' ? 'You voted. Votes are final.' : `You voted ${voted ? 'yes' : 'no'}. Votes are final.`}</strong></p>
                  )}
                </div>
              )}
            </CampaignReceipt>
          );
        }) : <p className="empty">You haven’t backed a campaign yet. Pick one under Campaigns.</p>}
      </div>
    </>
  );
}
