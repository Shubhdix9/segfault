import CampaignReceipt from './CampaignReceipt.jsx';

export default function ExplorePage({ campaigns, onDonate, simulatedPol }) {
  return (
    <>
      <section className="hero">
        <div>
          <h1>Your money. Their receipts. Your vote.</h1>
          <p>You fund a water project. The NGO uploads its receipt and proof JSON to IPFS. Donors vote on that evidence; an approved payout unlocks the next milestone.</p>
          <a className="btn go hero-link" href="#portfolio">See my donations</a>
        </div>
        <article className="rcpt tilt">
          <h3>How a payout works</h3>
          <div className="by">1 {simulatedPol ? 'simulated ' : ''}POL donated = 1 vote</div>
          <div className="ln"><span>NGO posts receipt</span><i /><span>Day 0</span></div>
          <div className="ln"><span>Donors vote</span><i /><span>24 h</span></div>
          <div className="ln"><span>Over half say yes</span><i /><span>PAID</span></div>
          <div className="ln"><span>Otherwise</span><i /><span>HELD</span></div>
          <div className="stub">
            {simulatedPol
              ? 'Funding and vote weights are simulated. No wallet or gas is involved.'
              : 'Amounts in each campaign are in POL.'}
          </div>
          <div className="text-right"><span className="stamp ok">NO AUDITOR</span></div>
        </article>
      </section>
      <h2>Open campaigns</h2>
      <p className="sub">Each line is a payout that stays locked until donors approve its receipt.</p>
      <div className="rack">
        {campaigns.map((campaign) => (
          <CampaignReceipt key={campaign.id} campaign={campaign}>
            <button className="btn go" onClick={() => onDonate(campaign)}>
              {simulatedPol ? 'Try a simulated donation' : 'Donate to this campaign'}
            </button>
          </CampaignReceipt>
        ))}
        {!campaigns.length && <p className="empty">No campaigns have been published on this registry yet.</p>}
      </div>
    </>
  );
}
