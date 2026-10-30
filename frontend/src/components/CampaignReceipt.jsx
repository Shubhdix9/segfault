import { milestoneLabels } from '../data/aquachain.js';

function MilestoneLine({ milestone }) {
  const lineClass = milestone.st === 'disbursed' ? 'done' : milestone.st === 'voting' ? 'vote' : '';

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
