import CampaignReceipt from './CampaignReceipt.jsx';

export default function ExplorePage({ campaigns, onDonate }) {
  return (
    <>
      <section className="hero">
        <div>
          <h1>Your money. Their receipts. Your vote.</h1>
          <p>You fund a water project. The NGO uploads the receipt for each purchase. The people who donated vote on it. Pass, and the next payout goes out by itself.</p>
          <a className="btn go hero-link" href="#portfolio">See my donations</a>
        </div>
        <article className="rcpt tilt">
          <h3>How a payout works</h3>
          <div className="by">1 POL donated = 1 vote</div>
          <div className="ln"><span>NGO posts receipt</span><i /><span>Day 0</span></div>
          <div className="ln"><span>Donors vote</span><i /><span>24 h</span></div>
          <div className="ln"><span>Over half say yes</span><i /><span>PAID</span></div>
          <div className="ln"><span>Otherwise</span><i /><span>HELD</span></div>
          <div className="stub">Amounts in each campaign are in POL.</div>
          <div className="text-right"><span className="stamp ok">NO AUDITOR</span></div>
        </article>
      </section>
      <h2>Open campaigns</h2>
      <p className="sub">Each line is a payout that stays locked until donors approve its receipt.</p>
      <div className="rack">
        {campaigns.map((campaign) => (
          <CampaignReceipt key={campaign.id} campaign={campaign}>
            <button className="btn go" onClick={() => onDonate(campaign)}>Donate to this campaign</button>
          </CampaignReceipt>
        ))}
        {!campaigns.length && <p className="empty">No campaigns have been published on this registry yet.</p>}
      </div>
    </>
  );
}
