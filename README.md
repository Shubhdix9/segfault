# WellChain System Architecture Specification & Product Blueprint

## 1. Executive Summary & Feasibility Verdict

Donor review and a personalized "Impact Portfolio" dashboard provide a practical way for contributors to review milestone evidence.

The current contract uses **contribution-weighted donor voting**; it does not implement quadratic voting. Donor review adds transparency, but does not eliminate collusion or guarantee that uploaded evidence is genuine.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            WellChain PLATFORM ENGINE                             │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   [ NGO ] ──1. Submits IPFS Receipt──► [ Milestone Escrow ]                      │
│                                                   │                              │
│                                          2. Triggers Voting                      │
│                                             Window (24h)                         │
│                                                   ▼                              │
│   [ DONORS ] ◄──3. Personal Portfolio ── [ 1 POL = 1 Vote ] ──4. Passed (50%+)   │
│   Dashboard     & Audit Notification              │                   │          │
│                                                   ▼                   ▼          │
│                                            [ Rejected ]     [ Finalize & Pay ]    │
│                                             (Locked)        (to NGO wallet)       │
└──────────────────────────────────────────────────────────────────────────────────┘

```

---

## 2. Donor-Governed Audit Mechanism

When donors fund a campaign, their wallet address and contribution amount are recorded on-chain. This contribution serves dual purposes: campaign funding and governance voting weight.

* **Voting Power:** $1 \text{ POL Donated} = 1 \text{ Governance Vote}$.
* **Proof Submission:** The NGO uploads receipt photos to IPFS and calls `submitProof(campaignId, milestoneId, ipfsCID)`.
* **Voting Window:** A 24-hour voting timer opens for that milestone.
* **Approval Threshold:** The contract permits early finalization when YES weight exceeds half of all funds raised. A transaction must still call `finalizeMilestone`; the frontend submits it after a qualifying YES vote. After the voting deadline, anyone can submit that finalization transaction.

---

## 3. Donor Impact Dashboard Specification

When a donor connects their wallet (`0xDonor...`), the React client queries the contract mapping `donorCampaignHistory[msg.sender]` to dynamically build their personal portfolio view.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ MY DONOR IMPACT PORTFOLIO                                 Connected: 0x8F3a...91bc [🟢] │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ Total Contributed: 450 POL  |  Campaigns Backed: 3  |  Milestone Votes Cast: 7           │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  [ CAMPAIGN 1: Clean Water for District 4 ]                                             │
│  Your Contribution: 200 POL (40% of total pool)                                         │
│  Current Milestone: #2 - Ceramic Filter Procurement (100 POL)                           │
│                                                                                         │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │ ⚠️ ACTION REQUIRED: Approve Milestone #2 Proof                                     │  │
│  │ Receipt Uploaded: [ View Store Receipt on IPFS ↗ ]                                │  │
│  │ Current Voting Status: 75% YES / 25% NO (Quorum Met)                              │  │
│  │ Your Vote: [ Vote YES ]   [ Vote NO / Flag Fraud ]                                 │  │
│  └───────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                         │
│  Historical Fund Trail for Campaign 1:                                                  │
│  • M1 (Seed Advance - 40 POL): Disbursed ── [ View Polygonscan ↗ ]                       │
│  • M2 (Filters - 100 POL): In Voting                                                    │
│  • M3 (Logistics - 60 POL): Locked                                                      │
│                                                                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│  [ CAMPAIGN 2: Flood Relief Food Packs ]                                                │
│  Your Contribution: 250 POL  |  Status: 100% Completed & Verified                      │
│  • M1: Disbursed [ View IPFS Receipt ↗ ]                                                │
│  • M2: Disbursed [ View IPFS Receipt ↗ ]                                                │
└─────────────────────────────────────────────────────────────────────────────────────────┘

```

---

## 4. Smart Contract Specification (`CharityRegistry.sol`)

A single central registry contract handles all campaigns, donor tracking, IPFS metadata, and governance voting.

> The code sketch below documents the original design only; it is not the deployable contract. The implementation and tests in [`charityregistry/contracts/CharityRegistry.sol`](./charityregistry/contracts/CharityRegistry.sol) are authoritative and include authorization, isolated escrow, target-budget checks, and milestone-order enforcement.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CharityRegistry {
    enum MilestoneStatus { Pending, ProofSubmitted, Approved, Rejected, Disbursed }

    struct Milestone {
        string description;
        uint256 amount;
        string ipfsProofCID;
        MilestoneStatus status;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 votingDeadline;
    }

    struct Campaign {
        uint256 id;
        address payable ngoAddress;
        string ipfsMetaCID;       // Title, description, banner image on IPFS
        uint256 targetAmount;
        uint256 totalRaised;
        uint256 seedAdvancePct;
        bool seedClaimed;
        uint256 milestoneCount;
        bool isActive;
    }

    // Global Registry State
    uint256 public campaignCounter;
    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(uint256 => Milestone)) public milestones;

    // Donor Tracking for Portfolio Dashboard
    mapping(uint256 => mapping(address => uint256)) public donorContributions; // campaignId => donor => amount
    mapping(address => uint256[]) public donorCampaignHistory;                  // donor => array of campaignIds
    mapping(address => mapping(uint256 => bool)) private hasTrackedCampaign;     // Prevents duplicate campaign IDs in history

    // Voting State: campaignId => milestoneId => donorAddress => hasVoted
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public hasVoted;

    // Events for Front-End Live Feeds
    event CampaignCreated(uint256 indexed campaignId, address indexed ngo, uint256 target);
    event DonationReceived(uint256 indexed campaignId, address indexed donor, uint256 amount);
    event ProofSubmitted(uint256 indexed campaignId, uint256 indexed milestoneId, string ipfsCID);
    event VoteCast(uint256 indexed campaignId, uint256 indexed milestoneId, address indexed voter, bool approve, uint256 weight);
    event MilestoneFinalized(uint256 indexed campaignId, uint256 indexed milestoneId, bool approved, uint256 amountDisbursed);

    // --- 1. CREATE CAMPAIGN ---
    function createCampaign(
        string memory _ipfsMetaCID,
        uint256 _targetAmount,
        uint256 _seedAdvancePct,
        string[] memory _milestoneDescs,
        uint256[] memory _milestoneAmounts
    ) external returns (uint256) {
        require(_milestoneDescs.length == _milestoneAmounts.length, "Mismatched milestone inputs");

        campaignCounter++;
        Campaign storage c = campaigns[campaignCounter];
        c.id = campaignCounter;
        c.ngoAddress = payable(msg.sender);
        c.ipfsMetaCID = _ipfsMetaCID;
        c.targetAmount = _targetAmount;
        c.seedAdvancePct = _seedAdvancePct;
        c.milestoneCount = _milestoneDescs.length;
        c.isActive = true;

        for (uint256 i = 0; i < _milestoneDescs.length; i++) {
            milestones[campaignCounter][i] = Milestone({
                description: _milestoneDescs[i],
                amount: _milestoneAmounts[i],
                ipfsProofCID: "",
                status: MilestoneStatus.Pending,
                yesVotes: 0,
                noVotes: 0,
                votingDeadline: 0
            });
        }

        emit CampaignCreated(campaignCounter, msg.sender, _targetAmount);
        return campaignCounter;
    }

    // --- 2. DONATE TO CAMPAIGN ---
    function donate(uint256 _campaignId) external payable {
        Campaign storage c = campaigns[_campaignId];
        require(c.isActive, "Campaign inactive");
        require(msg.value > 0, "Must donate POL");

        c.totalRaised += msg.value;
        donorContributions[_campaignId][msg.sender] += msg.value;

        // Add to donor history array if first time donating to this campaign
        if (!hasTrackedCampaign[msg.sender][_campaignId]) {
            donorCampaignHistory[msg.sender].push(_campaignId);
            hasTrackedCampaign[msg.sender][_campaignId] = true;
        }

        emit DonationReceived(_campaignId, msg.sender, msg.value);
    }

    // --- 3. CLAIM SEED ADVANCE (NGO) ---
    function claimSeedAdvance(uint256 _campaignId) external {
        Campaign storage c = campaigns[_campaignId];
        require(msg.sender == c.ngoAddress, "Not NGO");
        require(!c.seedClaimed, "Seed already claimed");
        require(c.totalRaised >= (c.targetAmount * c.seedAdvancePct) / 100, "Target seed threshold not met");

        c.seedClaimed = true;
        uint256 seedAmount = (c.totalRaised * c.seedAdvancePct) / 100;
        c.ngoAddress.transfer(seedAmount);
    }

    // --- 4. SUBMIT PROOF (NGO) ---
    function submitProof(uint256 _campaignId, uint256 _milestoneId, string memory _ipfsCID) external {
        Campaign storage c = campaigns[_campaignId];
        require(msg.sender == c.ngoAddress, "Not NGO");

        Milestone storage m = milestones[_campaignId][_milestoneId];
        require(m.status == MilestoneStatus.Pending, "Milestone not pending");

        m.ipfsProofCID = _ipfsCID;
        m.status = MilestoneStatus.ProofSubmitted;
        m.votingDeadline = block.timestamp + 1 days; // 24-hour voting window

        emit ProofSubmitted(_campaignId, _milestoneId, _ipfsCID);
    }

    // --- 5. DONOR VOTING ---
    function voteOnMilestone(uint256 _campaignId, uint256 _milestoneId, bool _approve) external {
        uint256 votingWeight = donorContributions[_campaignId][msg.sender];
        require(votingWeight > 0, "Only donors can vote");

        Milestone storage m = milestones[_campaignId][_milestoneId];
        require(m.status == MilestoneStatus.ProofSubmitted, "Voting not active");
        require(block.timestamp <= m.votingDeadline, "Voting deadline passed");
        require(!hasVoted[_campaignId][_milestoneId][msg.sender], "Already voted");

        hasVoted[_campaignId][_milestoneId][msg.sender] = true;

        if (_approve) {
            m.yesVotes += votingWeight;
        } else {
            m.noVotes += votingWeight;
        }

        emit VoteCast(_campaignId, _milestoneId, msg.sender, _approve, votingWeight);
    }

    // --- 6. FINALIZE MILESTONE & DISBURSE ---
    function finalizeMilestone(uint256 _campaignId, uint256 _milestoneId) external {
        Milestone storage m = milestones[_campaignId][_milestoneId];
        require(m.status == MilestoneStatus.ProofSubmitted, "Not in voting status");
        require(block.timestamp > m.votingDeadline || m.yesVotes > (campaigns[_campaignId].totalRaised / 2), "Voting still active");

        if (m.yesVotes > m.noVotes) {
            m.status = MilestoneStatus.Disbursed;
            campaigns[_campaignId].ngoAddress.transfer(m.amount);
            emit MilestoneFinalized(_campaignId, _milestoneId, true, m.amount);
        } else {
            m.status = MilestoneStatus.Rejected;
            emit MilestoneFinalized(_campaignId, _milestoneId, false, 0);
        }
    }

    // --- HELPER: GET DONOR CAMPAIGN HISTORY ---
    function getDonorCampaigns(address _donor) external view returns (uint256[] memory) {
        return donorCampaignHistory[_donor];
    }
}

```

---

## 5. Storage Architecture (Hybrid Web3 Model)

```
┌────────────────────────────────────────────────────────────────────────┐
│ ON-CHAIN STORAGE (Polygon Amoy)   │ OFF-CHAIN STORAGE (Pinata IPFS)    │
├───────────────────────────────────┼────────────────────────────────────┤
│ • POL Escrow Balances             │ • High-Res Receipt Images/PDFs     │
│ • Donor Contribution Amounts      │ • Campaign Banner Images           │
│ • Yes/No Vote Tallies             │ • Detailed Campaign Stories & Text │
│ • IPFS CIDs (content identifiers)│ • Vendor Invoices & Quotes         │
└───────────────────────────────────┴────────────────────────────────────┘

```

---

## 6. 22-Hour Execution Roadmap & Task Distribution

```
[Hours 0-4] ──► Deploy Smart Contract to Amoy Testnet & Pinata Setup
[Hours 4-10] ──► React Campaign Creation + Explorer Views
[Hours 10-15] ──► Donor Portfolio Dashboard & Voting Hooks
[Hours 15-18] ──► End-to-End Demo Testing & Fallback Setup
[Hours 18-22] ──► Pitch Deck Polish & Script Rehearsal

```

### Team Task Division

* **Developer 1 (Smart Contract & Web3 Integration):**
1. Paste `CharityRegistry.sol` into Remix IDE and deploy to Polygon Amoy Testnet (`Chain ID: 80002`).
2. Export Contract Address and ABI.
3. Write `ethers.js` or `Thirdweb` integration hooks (`donate`, `voteOnMilestone`, `getDonorCampaigns`).


* **Developer 2 (Frontend React/Tailwind UI):**
1. Build `/explore` page (Campaign Cards).
2. Build `/create` form (Upload metadata JSON to Pinata $\rightarrow$ deploy campaign).
3. Build `/portfolio` page (Donor Impact Dashboard showing user's backed campaigns, voting triggers, and IPFS receipt links).


* **Developer 3 / Pitch Lead (Pinata Pipeline & Slide Deck):**
1. Setup Pinata API keys for receipt uploads.
2. Create 5 pitch deck slides focusing on **Problem $\rightarrow$ Solution $\rightarrow$ Live Donor Governance Demo $\rightarrow$ Technical Architecture**.
3. Run 3 complete end-to-end rehearsal passes before presentation.

---

## Local Development and Testing

The app and upload API can be exercised before Pinata credentials or a deployed contract are available:

1. In `backend/.env`, set `PINATA_MODE=mock`. Mock uploads are held in memory and disappear when the API restarts; they are not pinned to IPFS.
2. Start the API with `cd backend && npm run dev`.
3. Start the frontend in another terminal with `cd frontend && npm run dev`.
4. Run `cd frontend && npm test && npm run build`, `cd backend && npm test`, and `cd charityregistry && node_modules/.bin/hardhat test`.

These tests cover upload requests, the local mock-storage round trip, API validation, and contract behavior. They do not prove that the provided Pinata account, deployed contract, wallet, or public RPC endpoint works end to end.

For real Pinata uploads, change `PINATA_MODE=pinata` and set `PINATA_JWT` in `backend/.env`. Keep the JWT server-side; never add it to a `VITE_` variable. For live contract use, set `VITE_CONTRACT_ADDRESS`, `VITE_CHAIN_ID=80002`, and `VITE_RPC_URL` in `frontend/.env`.

The escrow accounting and milestone-order checks in `CharityRegistry.sol` require a fresh deployment. An already deployed contract cannot acquire these changes by updating the frontend; use the address of the redeployed contract.

## Contract Behavior Notes

- Each campaign has an isolated escrow balance; funds from another campaign cannot cover a payout.
- The seed advance is a fixed percentage of the campaign target and is included in the campaign's target budget.
- Milestone payouts must fit the remaining target budget and must be submitted in order.
- A milestone payout is not triggered by a timer alone. A transaction must call `finalizeMilestone` after the vote threshold is reached or after the 24-hour window closes.
- Funds for rejected milestones remain in escrow; the current contract does not implement refunds or a milestone retry flow.