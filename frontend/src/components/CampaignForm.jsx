import { useState } from 'react';

export default function CampaignForm({ onPublish }) {
  const [milestoneCount, setMilestoneCount] = useState(2);

  return (
    <>
      <h2>Start a campaign</h2>
      <p className="sub">Break the work into payouts. Donors vote on the receipt for each one before the NGO is paid.</p>
      <form className="f" onSubmit={(event) => onPublish(event, milestoneCount, () => setMilestoneCount(2))}>
        <label>
          Title
          <input name="title" required placeholder="Handpumps for Ward 9" />
        </label>
        <label>
          Story (stored in the campaign JSON on IPFS)
          <textarea name="story" rows="4" placeholder="Who needs water, and what will this fix?" />
        </label>
        <label>
          Campaign image (optional)
          <input name="banner" type="file" accept="image/*" />
        </label>
        <label>
          Funding target in POL
          <input name="target" type="number" min="1" required />
        </label>
        <label>
          Seed advance in percent, paid before any vote
          <input name="seed" type="number" min="0" max="50" defaultValue="10" />
        </label>
        <fieldset>
          <legend>Milestones</legend>
          {Array.from({ length: milestoneCount }, (_, index) => (
            <div className="msrow" key={index}>
              <input name={`md${index}`} placeholder={`Milestone ${index + 1}: what gets bought?`} required />
              <input name={`ma${index}`} type="number" min="1" placeholder="POL" required />
            </div>
          ))}
          <button type="button" className="btn" onClick={() => setMilestoneCount((count) => count + 1)}>Add milestone</button>
        </fieldset>
        <button className="btn go publish-button">Publish campaign</button>
      </form>
    </>
  );
}
