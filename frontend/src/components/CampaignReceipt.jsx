import { milestoneLabels } from '../data/WellChain.js';
import { getIPFSUrl } from '../services/ipfs.js';

function MilestoneLine({ milestone }) {
  const lineClass = milestone.st === 'disbursed' ? 'done' : milestone.st === 'voting' ? 'vote' : '';
  const receiptUrl = milestone.receiptCid
    ? getIPFSUrl(milestone.receiptCid)
    : milestone.proofIsMetadata
      ? ''
      : milestone.proofCid ? getIPFSUrl(milestone.proofCid) : '';
  const proofMetadataUrl = milestone.proofIsMetadata && milestone.proofCid
    ? getIPFSUrl(milestone.proofCid)
    : '';

  return (
    <>
      <div className={`ln ${lineClass}`}>
        <span>{milestone.n}</span><i /><span>{milestone.amt}</span>
      </div>
      {milestone.st !== 'locked' && (
        <div className="text-right">
          <span className={`stamp ${milestone.st === 'disbursed' ? 'ok' : ''}`}>
            {milestoneLabels[milestone.st]}
          </span>
        </div>
      )}
      {(receiptUrl || proofMetadataUrl) && (
        <div className="ipfs-links">
          {receiptUrl && (
            <a href={receiptUrl} target="_blank" rel="noopener noreferrer">Receipt file ↗</a>
          )}
          {proofMetadataUrl && (
            <a href={proofMetadataUrl} target="_blank" rel="noopener noreferrer">Proof JSON ↗</a>
          )}
        </div>
      )}
    </>
  );
}

export default function CampaignReceipt({ campaign, children, className = '' }) {
  const progress = Math.min(100, Math.round((campaign.raised / campaign.target) * 100));

  return (
    <article className={`rcpt ${className}`}>
      <h3>{campaign.title}</h3>
      <div className="by">
        NGO: {campaign.ngo}<br />
        Campaign #{String(campaign.id).padStart(4, '0')}
        {campaign.paused && <> <span className="stamp">PAUSED</span></>}
      </div>
      {campaign.story && <p className="campaign-story">{campaign.story}</p>}
      {campaign.metaCid && (
        <div className="ipfs-links">
          <a href={getIPFSUrl(campaign.metaCid)} target="_blank" rel="noopener noreferrer">
            Campaign JSON on IPFS ↗
          </a>
        </div>
      )}
      {campaign.ms.map((milestone, index) => (
        <MilestoneLine key={`${milestone.n}-${index}`} milestone={milestone} />
      ))}
      <div className="tot">
        <span>RAISED</span><span>{campaign.raised} / {campaign.target} POL</span>
      </div>
      <div
        className="meter"
        style={{ '--p': `${progress}%` }}
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin="0"
        aria-valuemax="100"
      />
      {children}
    </article>
  );
}
