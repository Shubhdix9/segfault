export const CONFIG = {
  address: import.meta.env.VITE_CONTRACT_ADDRESS || '',
  admin: import.meta.env.VITE_ADMIN_ADDRESS || '',
  chainId: Number(import.meta.env.VITE_CHAIN_ID || 80002),
  rpcUrl: import.meta.env.VITE_RPC_URL || 'https://rpc-amoy.polygon.technology',
};

export const ABI = [
  'function admin() view returns (address)',
  'function campaignCounter() view returns (uint256)',
  'function campaigns(uint256) view returns (uint256 id,address ngoAddress,string ipfsMetaCID,uint256 targetAmount,uint256 totalRaised,uint256 seedAdvancePct,bool seedClaimed,uint256 milestoneCount,bool isActive)',
  'function milestones(uint256,uint256) view returns (string description,uint256 amount,string ipfsProofCID,uint8 status,uint256 yesVotes,uint256 noVotes,uint256 votingDeadline)',
  'function donorContributions(uint256,address) view returns (uint256)',
  'function getDonorCampaigns(address) view returns (uint256[])',
  'function hasVoted(uint256,uint256,address) view returns (bool)',
  'function isVerifiedNGO(address) view returns (bool)',
  'function authorizeNGO(address)',
  'function submitProof(uint256,uint256,string)',
  'function claimSeedAdvance(uint256)',
  'function donate(uint256) payable',
  'function voteOnMilestone(uint256,uint256,bool)',
  'function finalizeMilestone(uint256,uint256)',
  'function createCampaign(string,uint256,uint256,string[],uint256[]) returns (uint256)',
];

export const initialNgos = [
  { name: 'Jal Seva Trust', w: '0x8F3a…91bc', st: 'approved' },
  { name: 'Tankaa Foundation', w: '0x71C2…09aE', st: 'pending' },
  { name: 'Marusthal Water Forum', w: '0x44d0…c3B1', st: 'pending' },
];

export const initialCampaigns = [
  {
    id: 1,
    title: 'Clean water, District 4',
    ngo: 'Jal Seva Trust',
    own: true,
    raised: 500,
    target: 800,
    mine: 200,
    ms: [
      { n: 'Seed advance', seed: true, amt: 40, st: 'disbursed' },
      { n: 'Ceramic filters', amt: 100, st: 'voting', yes: 150, no: 50 },
      { n: 'Logistics', amt: 60, st: 'locked' },
    ],
  },
  {
    id: 2,
    title: 'Flood relief food packs',
    ngo: 'Bandh Relief Collective',
    raised: 600,
    target: 600,
    mine: 250,
    ms: [
      { n: 'Bulk grain', amt: 300, st: 'disbursed' },
      { n: 'Packing, transport', amt: 300, st: 'disbursed' },
    ],
  },
  {
    id: 3,
    title: 'Borewell repair, Barmer',
    ngo: 'Jal Seva Trust',
    own: true,
    raised: 180,
    target: 500,
    mine: 0,
    ms: [
      { n: 'Seed advance', seed: true, amt: 50, st: 'pending' },
      { n: 'Pump parts', amt: 150, st: 'locked' },
      { n: 'Labour, testing', amt: 100, st: 'locked' },
    ],
  },
  {
    id: 4,
    title: 'Rain tanks, three schools',
    ngo: 'Tankaa Foundation',
    raised: 90,
    target: 300,
    mine: 0,
    ms: [
      { n: 'Tank fabrication', amt: 180, st: 'pending' },
      { n: 'Plumbing, gutters', amt: 70, st: 'locked' },
    ],
  },
];

export const milestoneLabels = {
  disbursed: 'PAID',
  voting: 'VOTING',
  pending: 'AWAITING RECEIPT',
  locked: 'LOCKED',
  approved: 'APPROVED',
  rejected: 'REJECTED',
};
