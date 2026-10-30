import { Contract, JsonRpcProvider, formatEther } from 'ethers';
import { ABI, CONFIG } from '../data/WellChain.js';
import { fetchIPFSJSON } from './ipfs.js';

const milestoneStatuses = ['pending', 'voting', 'approved', 'rejected', 'disbursed'];

function asPol(value) {
  return Number(Number(formatEther(value)).toFixed(6));
}

function short(address) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function createReadContract() {
  if (!CONFIG.address) throw new Error('Set VITE_CONTRACT_ADDRESS to read the deployed registry.');
  return new Contract(CONFIG.address, ABI, new JsonRpcProvider(CONFIG.rpcUrl, CONFIG.chainId));
}

export async function readRegistry(contract, account) {
  const [counter, admin] = await Promise.all([
    contract.campaignCounter(),
    contract.admin(),
  ]);
  const campaignIds = Array.from({ length: Number(counter) }, (_, index) => index + 1);
  const campaigns = [];
  const voteState = {};
  const knownNgos = new Map();

  for (const id of campaignIds) {
    const raw = await contract.campaigns(id);
    const campaignAccount = raw.ngoAddress;
    const metaCid = raw.ipfsMetaCID;
    let metadata = {};
    let metadataError = '';
    if (metaCid) {
      try {
        metadata = await fetchIPFSJSON(metaCid);
      } catch (error) {
        metadataError = error.message;
      }
    }

    const milestoneCount = Number(raw.milestoneCount);
    const milestoneResults = await Promise.all(
      Array.from({ length: milestoneCount }, (_, index) => Promise.all([
        contract.milestones(id, index),
        account ? contract.hasVoted(id, index, account) : false,
      ])),
    );
    const milestones = milestoneResults.map(([milestone, hasVoted], index) => {
      const status = milestoneStatuses[Number(milestone.status)] || 'pending';
      if (account && hasVoted) voteState[`${id}-${index}`] = 'cast';
      return {
        index,
        n: milestone.description,
        amt: asPol(milestone.amount),
        st: status,
        yes: asPol(milestone.yesVotes),
        no: asPol(milestone.noVotes),
        proofCid: milestone.ipfsProofCID,
        deadline: Number(milestone.votingDeadline),
        hasVoted,
      };
    });
    for (let index = 1; index < milestones.length; index += 1) {
      if (milestones[index].st === 'pending' && milestones[index - 1].st !== 'disbursed') {
        milestones[index].st = 'locked';
      }
    }

    const contribution = account ? await contract.donorContributions(id, account) : 0n;
    const ngoName = typeof metadata.ngoName === 'string' ? metadata.ngoName : short(campaignAccount);
    const verified = await contract.isVerifiedNGO(campaignAccount);
    const seedBudget = (raw.targetAmount / 100n) * raw.seedAdvancePct
      + ((raw.targetAmount % 100n) * raw.seedAdvancePct) / 100n;
    knownNgos.set(campaignAccount.toLowerCase(), {
      name: ngoName,
      w: campaignAccount,
      st: verified ? 'approved' : 'revoked',
    });

    campaigns.push({
      id,
      title: typeof metadata.title === 'string' ? metadata.title : `Campaign #${String(id).padStart(4, '0')}`,
      story: typeof metadata.story === 'string' ? metadata.story : '',
      bannerCid: typeof metadata.bannerCid === 'string' ? metadata.bannerCid : '',
      metadataError,
      metaCid,
      ngo: ngoName,
      ngoAddress: campaignAccount,
      own: Boolean(account && campaignAccount.toLowerCase() === account.toLowerCase()),
      raised: asPol(raw.totalRaised),
      target: asPol(raw.targetAmount),
      mine: asPol(contribution),
      seedAdvancePct: Number(raw.seedAdvancePct),
      seedAmount: asPol(seedBudget),
      canClaimSeed: raw.totalRaised >= seedBudget,
      seedClaimed: raw.seedClaimed,
      active: raw.isActive,
      ms: milestones,
    });
  }

  if (account) {
    const donorHistory = await contract.getDonorCampaigns(account);
    const donorIds = new Set(donorHistory.map(Number));
    for (const campaign of campaigns) {
      if (!donorIds.has(campaign.id)) campaign.mine = 0;
    }
  }

  return {
    campaigns,
    votes: voteState,
    ngos: Array.from(knownNgos.values()),
    admin,
  };
}
