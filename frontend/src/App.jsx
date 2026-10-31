import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserProvider, Contract, formatEther, isAddress, parseEther } from 'ethers';
import Header from './components/Header.jsx';
import ExplorePage from './components/ExplorePage.jsx';
import PortfolioPage from './components/PortfolioPage.jsx';
import NgoPage from './components/NgoPage.jsx';
import AdminPage from './components/AdminPage.jsx';
import DonateDialog from './components/DonateDialog.jsx';
import DemoConsole from './components/DemoConsole.jsx';
import Toast from './components/Toast.jsx';
import {
  ABI,
  CONFIG,
  demoActors,
  initialCampaigns,
  initialNgos,
} from './data/WellChain.js';
import {
  fetchIPFSJSON,
  getIPFSHealth,
  uploadFileToIPFS,
  uploadJSONToIPFS,
} from './services/ipfs.js';
import { createReadContract, readRegistry } from './services/registry.js';

const hasLiveRegistry = Boolean(CONFIG.address && CONFIG.enableLiveTransactions);
const demoStoreKey = 'wellchain-presentation-demo-v2';
const availableViews = ['explore', 'portfolio', 'ngo', 'admin'];

function getErrorMessage(error) {
  if (error?.code === 4001 || error?.info?.error?.code === 4001) {
    return 'User rejected the request in wallet.';
  }
  if (error?.message?.includes('network changed')) {
    return 'Network changed. Reconnecting...';
  }
  if (error?.message?.includes('could not coalesce error') || error?.code === -32002) {
    return 'MetaMask prompt already pending. Please open MetaMask extension.';
  }
  return error?.reason || error?.shortMessage || error?.info?.error?.message || error?.message || 'Unknown error';
}

function short(address) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function readDemoState() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(demoStoreKey) || 'null');
    if (saved?.version === 2 && Array.isArray(saved.campaigns) && Array.isArray(saved.ngos)) {
      return saved;
    }
  } catch {
    return null;
  }
  return null;
}

function campaignForActor(campaign, address) {
  return {
    ...campaign,
    own: Boolean(address && campaign.ngoAddress
      && campaign.ngoAddress.toLowerCase() === address.toLowerCase()),
    mine: Number(campaign.contributions?.[address] || 0),
  };
}

export default function App() {
  const [savedDemo] = useState(() => (hasLiveRegistry ? null : readDemoState()));
  const [account, setAccount] = useState(() => (
    hasLiveRegistry ? null : savedDemo?.account || demoActors.donor.address
  ));
  const [demo, setDemo] = useState(!hasLiveRegistry);
  const [campaigns, setCampaigns] = useState(() => (
    hasLiveRegistry
      ? []
      : (savedDemo?.campaigns || initialCampaigns)
        .map((campaign) => campaignForActor(campaign, savedDemo?.account || demoActors.donor.address))
  ));
  const [ngos, setNgos] = useState(() => savedDemo?.ngos || initialNgos);
  const [votes, setVotes] = useState(() => savedDemo?.votes || {});
  const [registryAdmin, setRegistryAdmin] = useState('');
  const [isVerifiedNgo, setIsVerifiedNgo] = useState(false);
  const [storage, setStorage] = useState(null);
  const [view, setView] = useState(() => {
    const initialView = window.location.hash.slice(1);
    return availableViews.includes(initialView) ? initialView : 'explore';
  });
  const [donationCampaign, setDonationCampaign] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef(null);
  const signerRef = useRef(null);
  const activeVotes = hasLiveRegistry
    ? votes
    : Object.fromEntries(Object.entries(votes)
      .filter(([key]) => key.startsWith(`${account}:`))
      .map(([key, value]) => [key.slice(account.length + 1), value]));

  const toast = useCallback((message) => {
    setToastMessage(message);
    setToastVisible(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 3400);
  }, []);

  const refreshStorage = async (notify = false) => {
    try {
      const health = await getIPFSHealth();
      setStorage({ ...health, online: true });
      if (notify) toast('Upload API status refreshed.');
    } catch (error) {
      setStorage({ online: false, pinataConfigured: false });
      if (notify) toast(`IPFS upload API unavailable: ${getErrorMessage(error)}`);
    }
  };

  const refreshRegistry = useCallback(async (activeAccount, activeSigner) => {
    if (!hasLiveRegistry) return null;
    const contract = activeSigner
      ? new Contract(CONFIG.address, ABI, activeSigner)
      : createReadContract();
    const data = await readRegistry(contract, activeAccount);
    setCampaigns(data.campaigns);
    setVotes(data.votes);
    setNgos((current) => {
      const byAddress = new Map(current.map((ngo) => [ngo.w.toLowerCase(), ngo]));
      for (const ngo of data.ngos) byAddress.set(ngo.w.toLowerCase(), ngo);
      return Array.from(byAddress.values());
    });
    setRegistryAdmin(data.admin);
    setIsVerifiedNgo(data.isVerifiedNgo);
    for (const campaign of data.campaigns) {
      if (campaign.metadataError) {
        toast(`Campaign #${campaign.id} metadata could not be loaded: ${campaign.metadataError}`);
      }
    }
    return data;
  }, [toast]);

  useEffect(() => {
    const handleHashChange = () => {
      const nextView = window.location.hash.slice(1);
      setView(availableViews.includes(nextView) ? nextView : 'explore');
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  useEffect(() => {
    void refreshStorage();
  }, []);

  useEffect(() => {
    if (hasLiveRegistry) return;
    try {
      window.localStorage.setItem(demoStoreKey, JSON.stringify({
        version: 2,
        account,
        campaigns,
        ngos,
        votes,
      }));
    } catch (error) {
      toast(`Could not save presentation state in this browser: ${getErrorMessage(error)}`);
    }
  }, [account, campaigns, ngos, toast, votes]);

  useEffect(() => {
    if (hasLiveRegistry || !account) return;
    setIsVerifiedNgo(ngos.some((ngo) => (
      ngo.w.toLowerCase() === account.toLowerCase() && ngo.st === 'approved'
    )));
  }, [account, ngos]);

  useEffect(() => {
    if (hasLiveRegistry || !savedDemo?.campaigns?.length) return undefined;
    let cancelled = false;
    Promise.all(savedDemo.campaigns.map(async (campaign) => {
      if (!campaign.metaCid) return campaign;
      try {
        const metadata = await fetchIPFSJSON(campaign.metaCid);
        return { ...campaign, ...metadata };
      } catch (error) {
        toast(`Campaign #${campaign.id} metadata could not be read from IPFS: ${getErrorMessage(error)}`);
        return campaign;
      }
    })).then((restoredCampaigns) => {
      if (!cancelled) {
        const restoredById = new Map(restoredCampaigns.map((campaign) => [campaign.id, campaign]));
        setCampaigns((current) => current.map((campaign) => {
          const restored = restoredById.get(campaign.id);
          if (!campaign.metaCid || !restored) return campaign;
          return {
            ...campaign,
            title: restored.title || campaign.title,
            story: restored.story || '',
            bannerCid: restored.bannerCid || '',
            ngo: restored.ngoName || campaign.ngo,
          };
        }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [savedDemo, toast]);

  useEffect(() => {
    if (!hasLiveRegistry) return;
    refreshRegistry(null, null).catch((error) => {
      // Ignore network changed transient errors during initial mount
      if (error?.message?.includes('network changed')) return;
      toast(`Could not load the campaign registry: ${getErrorMessage(error)}`);
    });
  }, [refreshRegistry, toast]);

  useEffect(() => {
    if (!hasLiveRegistry) return undefined;
    const wallet = window.ethereum;
    if (!wallet?.on) return undefined;

    const refreshWalletAccount = async (accounts) => {
      if (!accounts.length) {
        signerRef.current = null;
        setAccount(null);
        setVotes({});
        setIsVerifiedNgo(false);
        return;
      }
      try {
        const provider = new BrowserProvider(wallet, 'any');
        const activeSigner = await provider.getSigner(accounts[0]);
        const activeAccount = await activeSigner.getAddress();
        signerRef.current = activeSigner;
        setAccount(activeAccount);
        if (hasLiveRegistry) await refreshRegistry(activeAccount, activeSigner);
      } catch (error) {
        if (!error?.message?.includes('network changed')) {
          toast(`Could not update the connected wallet: ${getErrorMessage(error)}`);
        }
      }
    };

    const handleAccountsChanged = (accounts) => {
      void refreshWalletAccount(accounts);
    };
    const handleChainChanged = (chainId) => {
      const newChainId = Number.parseInt(chainId, 16);
      if (hasLiveRegistry && newChainId !== CONFIG.chainId) {
        signerRef.current = null;
        setAccount(null);
        setVotes({});
        setIsVerifiedNgo(false);
        toast(`Switch your wallet to chain ${CONFIG.chainId} to use the registry.`);
      }
    };
    wallet.on('accountsChanged', handleAccountsChanged);
    wallet.on('chainChanged', handleChainChanged);
    return () => {
      wallet.removeListener?.('accountsChanged', handleAccountsChanged);
      wallet.removeListener?.('chainChanged', handleChainChanged);
    };
  }, [refreshRegistry, toast]);

  const connect = async () => {
    if (!hasLiveRegistry) {
      const previewAccount = account || demoActors.donor.address;
      setAccount(previewAccount);
      signerRef.current = null;
      setDemo(true);
      toast('Presentation mode: POL is simulated; IPFS uploads use the configured storage service.');
      return previewAccount;
    }

    if (!window.ethereum) {
      toast('Install a wallet such as MetaMask to connect to the live registry.');
      return null;
    }

    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts || !accounts.length) {
        throw new Error('No accounts selected in wallet.');
      }

      if (hasLiveRegistry) {
        const desiredChain = `0x${CONFIG.chainId.toString(16)}`;
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: desiredChain }],
          });
        } catch (switchError) {
          if (switchError?.code === 4902 || switchError?.data?.originalError?.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: desiredChain,
                chainName: 'Polygon Amoy',
                nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
                rpcUrls: [
                  'https://polygon-amoy.drpc.org',
                  'https://polygon-amoy-rpc.blockreq.com/v1/rpc/public',
                  'https://polygon-amoy.gateway.tenderly.co',
                  'https://api.zan.top/polygon-amoy',
                  CONFIG.rpcUrl,
                ].filter(Boolean),
                blockExplorerUrls: ['https://amoy.polygonscan.com'],
              }],
            });
          } else {
            throw switchError;
          }
        }
      }

      const provider = new BrowserProvider(window.ethereum, 'any');
      const network = await provider.getNetwork();
      if (hasLiveRegistry && Number(network.chainId) !== CONFIG.chainId) {
        throw new Error(`Switch your wallet to chain ${CONFIG.chainId} and try again.`);
      }

      const connectedSigner = await provider.getSigner();
      const connectedAccount = await connectedSigner.getAddress();
      signerRef.current = connectedSigner;
      setAccount(connectedAccount);
      setDemo(!hasLiveRegistry);
      if (hasLiveRegistry) await refreshRegistry(connectedAccount, connectedSigner);
      return connectedAccount;
    } catch (error) {
      toast(`Wallet connection failed: ${getErrorMessage(error)}`);
      return null;
    }
  };

  const send = async (functionName, args, value) => {
    if (hasLiveRegistry) {
      if (!signerRef.current) throw new Error('Connect a wallet before sending a transaction.');
      const contract = new Contract(CONFIG.address, ABI, signerRef.current);
      const transaction = await contract[functionName](
        ...args,
        value === undefined ? {} : { value: parseEther(String(value)) },
      );
      toast('Transaction sent. Waiting for confirmation.');
      return transaction.wait();
    }
    await wait(350);
    return null;
  };

  const ensureConnected = async () => account || await connect();

  const selectDemoRole = (address) => {
    if (hasLiveRegistry) return;
    signerRef.current = null;
    setAccount(address);
    setDemo(true);
    setIsVerifiedNgo(ngos.some((ngo) => (
      ngo.w.toLowerCase() === address.toLowerCase() && ngo.st === 'approved'
    )));
    setCampaigns((current) => current.map((campaign) => campaignForActor(campaign, address)));
  };

  const resetDemo = () => {
    if (hasLiveRegistry) return;
    window.localStorage.removeItem(demoStoreKey);
    setAccount(demoActors.donor.address);
    setCampaigns(initialCampaigns.map((campaign) => campaignForActor(campaign, demoActors.donor.address)));
    setNgos(initialNgos);
    setVotes({});
    setIsVerifiedNgo(false);
    setDonationCampaign(null);
    setDemo(true);
    toast('Presentation demo reset to its starting state.');
  };

  const logout = () => {
    signerRef.current = null;
    setAccount(null);
    setVotes({});
    setIsVerifiedNgo(false);
    window.localStorage.removeItem(demoStoreKey);
    setDemo(false);
    toast(demo ? 'Exited demo mode. Connect a wallet to continue.' : 'Wallet disconnected.');
  };

  const enterDemo = () => {
    signerRef.current = null;
    const initialAccount = demoActors.donor.address;
    setAccount(initialAccount);
    setCampaigns(initialCampaigns.map((campaign) => campaignForActor(campaign, initialAccount)));
    setNgos(initialNgos);
    setVotes({});
    setIsVerifiedNgo(false);
    setDemo(true);
    toast('Entered presentation demo mode.');
  };

  const openDonation = (campaign) => {
    if (campaign.paused || campaign.active === false) {
      toast('This campaign is inactive and cannot accept donations.');
      return;
    }
    setDonationCampaign(campaign);
  };

  const donate = async (amount, message) => {
    if (message) {
      toast(message);
      return false;
    }
    const connectedAccount = await ensureConnected();
    if (!connectedAccount || !donationCampaign) return false;

    try {
      await send('donate', [donationCampaign.id], amount);
      if (hasLiveRegistry) {
        await refreshRegistry(connectedAccount, signerRef.current);
      } else {
        setCampaigns((current) => current.map((campaign) => (
          campaign.id === donationCampaign.id
            ? campaignForActor({
              ...campaign,
              raised: campaign.raised + amount,
              contributions: {
                ...campaign.contributions,
                [connectedAccount]: Number(campaign.contributions?.[connectedAccount] || 0) + amount,
              },
              canClaimSeed: campaign.seedAmount
                ? campaign.raised + amount >= campaign.seedAmount
                : campaign.canClaimSeed,
            }, connectedAccount)
            : campaign
        )));
      }
      const newTotal = donationCampaign.mine + amount;
      toast(`Donated ${amount} POL. You now hold ${newTotal} votes here.`);
      return true;
    } catch (error) {
      toast(`Donation failed: ${getErrorMessage(error)}`);
      return false;
    }
  };

  const vote = async (campaignId, milestoneIndex, yes) => {
    const campaign = campaigns.find((item) => item.id === campaignId);
    const milestone = campaign?.ms.find((item) => item.index === milestoneIndex)
      || campaign?.ms[milestoneIndex];
    if (!campaign || !milestone) return;
    if (hasLiveRegistry && (!account || campaign.mine <= 0 || milestone.hasVoted)) {
      toast('Only a donor who has not voted on this receipt can cast a vote.');
      return;
    }
    if (!hasLiveRegistry && campaign.mine <= 0) {
      toast('Switch to the donor role and contribute simulated POL before voting.');
      return;
    }

    const voteKey = hasLiveRegistry
      ? `${campaignId}-${milestoneIndex}`
      : `${account}:${campaignId}-${milestoneIndex}`;
    if (votes[voteKey] !== undefined) {
      toast('This demo donor has already voted on this receipt.');
      return;
    }

    try {
      await send('voteOnMilestone', [campaignId, milestoneIndex, yes]);
      if (hasLiveRegistry) {
        const contract = new Contract(CONFIG.address, ABI, signerRef.current);
        const [onChainCampaign, onChainMilestone] = await Promise.all([
          contract.campaigns(campaignId),
          contract.milestones(campaignId, milestoneIndex),
        ]);
        if (
          onChainMilestone.yesVotes > onChainCampaign.totalRaised / 2n
          && onChainMilestone.yesVotes > onChainMilestone.noVotes
        ) {
          const transaction = await contract.finalizeMilestone(campaignId, milestoneIndex);
          toast('Vote passed the approval threshold. Finalizing payout.');
          await transaction.wait();
        }
        await refreshRegistry(account, signerRef.current);
      } else {
        const yesVotes = milestone.yes + (yes ? campaign.mine : 0);
        const noVotes = milestone.no + (yes ? 0 : campaign.mine);
        setVotes((current) => ({ ...current, [voteKey]: yes }));
        setCampaigns((current) => current.map((item) => {
          if (item.id !== campaignId) return item;
          const approved = yesVotes > item.raised / 2 && yesVotes > noVotes;
          const milestones = item.ms.map((entry, index) => {
            const entryIndex = entry.index ?? index;
            if (entryIndex === milestoneIndex) {
              return { ...entry, yes: yesVotes, no: noVotes, st: approved ? 'disbursed' : entry.st };
            }
            if (entryIndex === milestoneIndex + 1 && entry.st === 'locked' && approved) {
              return { ...entry, st: 'pending' };
            }
            return entry;
          });
          return { ...item, ms: milestones };
        }));
      }
      toast(yes ? 'You approved this payout.' : 'You flagged this receipt.');
    } catch (error) {
      toast(`Vote failed: ${getErrorMessage(error)}`);
    }
  };

  const finalizeMilestone = async (campaignId, milestoneIndex) => {
    try {
      if (hasLiveRegistry) {
        await send('finalizeMilestone', [campaignId, milestoneIndex]);
        await refreshRegistry(account, signerRef.current);
        toast('Milestone finalized.');
        return;
      }

      const campaign = campaigns.find((item) => item.id === campaignId);
      const milestone = campaign?.ms.find((item, index) => (item.index ?? index) === milestoneIndex);
      if (!campaign || !milestone || milestone.st !== 'voting') return;
      const approved = milestone.yes > milestone.no;
      setCampaigns((current) => current.map((item) => {
        if (item.id !== campaignId) return item;
        return {
          ...item,
          ms: item.ms.map((entry, index) => {
            const entryIndex = entry.index ?? index;
            if (entryIndex === milestoneIndex) return { ...entry, st: approved ? 'disbursed' : 'rejected' };
            if (approved && entryIndex === milestoneIndex + 1 && entry.st === 'locked') {
              return { ...entry, st: 'pending' };
            }
            return entry;
          }),
        };
      }));
      toast(approved ? 'Simulated payout approved. The next milestone is unlocked.' : 'Simulated vote rejected the payout.');
    } catch (error) {
      toast(`Could not finalize the milestone: ${getErrorMessage(error)}`);
    }
  };

  const publish = async (event, milestoneCount, resetMilestoneCount) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const connectedAccount = await ensureConnected();
    if (!connectedAccount) return;
    if (!isVerifiedNgo) {
      toast('Only an admin-authorized NGO wallet can publish campaigns.');
      return;
    }

    const title = String(formData.get('title') || '').trim();
    const milestones = Array.from({ length: milestoneCount }, (_, index) => ({
      n: String(formData.get(`md${index}`) || '').trim(),
      amountInput: String(formData.get(`ma${index}`) || '').trim(),
      st: index ? 'locked' : 'pending',
    }));
    const seedAdvancePct = Number(formData.get('seed'));
    let targetWei;
    try {
      targetWei = parseEther(String(formData.get('target') || '').trim());
      if (targetWei <= 0n) throw new Error('Target must be above zero.');
      for (const milestone of milestones) {
        if (!milestone.n || !milestone.amountInput) throw new Error('Every milestone needs a description and amount.');
        milestone.amountWei = parseEther(milestone.amountInput);
        if (milestone.amountWei <= 0n) throw new Error('Every milestone amount must be above zero.');
      }
    } catch (error) {
      toast(`Enter valid POL amounts: ${getErrorMessage(error)}`);
      return;
    }
    if (!title) {
      toast('Enter a campaign title.');
      return;
    }
    if (!Number.isInteger(seedAdvancePct) || seedAdvancePct < 0 || seedAdvancePct > 50) {
      toast('Seed advance must be a whole percentage from 0 to 50.');
      return;
    }
    const seedBudget = (targetWei / 100n) * BigInt(seedAdvancePct)
      + ((targetWei % 100n) * BigInt(seedAdvancePct)) / 100n;
    if (milestones.reduce((sum, milestone) => sum + milestone.amountWei, seedBudget) > targetWei) {
      toast('Seed advance and milestones add up to more than your target.');
      return;
    }

    try {
      const banner = formData.get('banner');
      const bannerUpload = banner instanceof File && banner.size > 0
        ? await uploadFileToIPFS(banner)
        : null;
      const metadata = {
        schemaVersion: 1,
        kind: 'wellchain-campaign',
        title,
        story: String(formData.get('story') || '').trim(),
        ngoName: ngos.find((ngo) => ngo.w.toLowerCase() === connectedAccount.toLowerCase())?.name
          || short(connectedAccount),
        ngoAddress: connectedAccount,
        bannerCid: bannerUpload?.cid || '',
        targetPol: String(formData.get('target') || '').trim(),
        seedAdvancePct,
        milestones: milestones.map((milestone) => ({
          description: milestone.n,
          amountPol: milestone.amountInput,
        })),
        demonstrationOnly: !hasLiveRegistry,
      };
      const { cid: metadataCid } = await uploadJSONToIPFS(metadata, metadata.title);
      const storedMetadata = await fetchIPFSJSON(metadataCid);
      if (storedMetadata.kind !== 'wellchain-campaign' || storedMetadata.title !== title) {
        throw new Error('Campaign JSON read back from IPFS did not match the submitted campaign.');
      }
      await send('createCampaign', [
        metadataCid,
        targetWei,
        seedAdvancePct,
        milestones.map((milestone) => milestone.n),
        milestones.map((milestone) => milestone.amountWei),
      ]);

      if (hasLiveRegistry) {
        await refreshRegistry(connectedAccount, signerRef.current);
      } else {
        setCampaigns((current) => [{
          id: Math.max(0, ...current.map((campaign) => campaign.id)) + 1,
          ...storedMetadata,
          metaCid: metadataCid,
          ngo: storedMetadata.ngoName,
          ngoAddress: connectedAccount,
          contributions: {},
          own: true,
          raised: 0,
          target: Number(formatEther(targetWei)),
          mine: 0,
          seedAdvancePct,
          seedAmount: Number(formatEther(seedBudget)),
          canClaimSeed: seedBudget === 0n,
          seedClaimed: false,
          ms: milestones.map((milestone) => ({
            n: milestone.n,
            amt: Number(formatEther(milestone.amountWei)),
            st: milestone.st,
          })),
        }, ...current]);
      }
      resetMilestoneCount();
      form.reset();
      toast('Campaign published.');
    } catch (error) {
      toast(`Could not publish: ${getErrorMessage(error)}`);
    }
  };

  const submitProof = async (campaignId, milestoneIndex, file) => {
    if (!file) {
      toast('Choose the receipt photo or PDF first.');
      return;
    }
    const campaign = campaigns.find((item) => item.id === campaignId);
    if (!campaign || !account || !campaign.own) {
      toast('Only the campaign’s NGO wallet can submit a receipt.');
      return;
    }
    try {
      const { cid: receiptCid } = await uploadFileToIPFS(file);
      const proofMetadata = {
        schemaVersion: 1,
        kind: 'wellchain-milestone-proof',
        campaignId,
        milestoneIndex,
        milestoneDescription: campaign.ms.find((milestone, index) => (
          (milestone.index ?? index) === milestoneIndex
        ))?.n || '',
        fileName: file.name,
        receiptCid,
        submittedBy: account,
        submittedAt: new Date().toISOString(),
        demonstrationOnly: !hasLiveRegistry,
      };
      const { cid: proofCid } = await uploadJSONToIPFS(
        proofMetadata,
        `proof-${campaignId}-${milestoneIndex}`,
      );
      const storedProof = await fetchIPFSJSON(proofCid);
      if (
        storedProof.kind !== 'wellchain-milestone-proof'
        || typeof storedProof.receiptCid !== 'string'
        || !storedProof.receiptCid
      ) {
        throw new Error('Proof JSON read back from IPFS is missing its receipt CID.');
      }
      await send('submitProof', [campaignId, milestoneIndex, proofCid]);
      if (hasLiveRegistry) {
        await refreshRegistry(account, signerRef.current);
      } else {
        setCampaigns((current) => current.map((campaign) => (
          campaign.id === campaignId
            ? {
              ...campaign,
              ms: campaign.ms.map((milestone, index) => (
                (milestone.index ?? index) === milestoneIndex
                  ? {
                    ...milestone,
                    st: 'voting',
                    yes: 0,
                    no: 0,
                    proofCid,
                    receiptCid: storedProof.receiptCid,
                    proofIsMetadata: true,
                    proofName: storedProof.fileName,
                    deadline: Math.floor(Date.now() / 1000) + 86400,
                  }
                  : milestone
              )),
            }
            : campaign
        )));
      }
      toast(hasLiveRegistry
        ? 'Receipt and proof JSON pinned to IPFS. Donor voting has started.'
        : 'Receipt and proof JSON uploaded to IPFS. Voting is simulated; no POL was spent.');
    } catch (error) {
      toast(`Could not submit the receipt: ${getErrorMessage(error)}`);
    }
  };

  const claimSeed = async (campaignId, milestoneIndex) => {
    const campaign = campaigns.find((item) => item.id === campaignId);
    if (!campaign) return;
    if (hasLiveRegistry && (!account || !campaign.own)) {
      toast('Only the campaign’s NGO wallet can claim its seed advance.');
      return;
    }
    if (!hasLiveRegistry && (!account || !campaign.own)) {
      toast('Switch to the NGO role that owns this campaign to claim its seed advance.');
      return;
    }
    if (
      !hasLiveRegistry
      && milestoneIndex !== undefined
      && campaign.raised < campaign.ms[milestoneIndex]?.amt
    ) {
      toast(`The seed advance unlocks at ${campaign.ms[milestoneIndex].amt} POL raised.`);
      return;
    }
    try {
      await send('claimSeedAdvance', [campaignId]);
      if (hasLiveRegistry) {
        await refreshRegistry(account, signerRef.current);
      } else {
        setCampaigns((current) => current.map((item) => {
          if (item.id !== campaignId) return item;
          const milestones = item.ms.map((milestone, index) => {
            if (milestone.seed) return { ...milestone, st: 'disbursed' };
            if (milestone.st === 'locked' && index > 0 && item.ms[index - 1].seed) {
              return { ...milestone, st: 'pending' };
            }
            return milestone;
          });
          return { ...item, seedClaimed: true, ms: milestones };
        }));
      }
      toast(demo ? 'Simulated seed advance claimed.' : 'Seed advance sent to your wallet.');
    } catch (error) {
      toast(`Claim failed: ${getErrorMessage(error)}`);
    }
  };

  const updateNgoStatus = (index, status) => {
    if (!isAdmin) {
      toast('Only the platform admin can change NGO status.');
      return;
    }
    setNgos((current) => current.map((ngo, ngoIndex) => (
      ngoIndex === index ? { ...ngo, st: status } : ngo
    )));
    toast(status === 'approved' ? 'NGO verified. It can now start campaigns.' : 'Application rejected.');
  };

  const authorizeNgo = async (address) => {
    if (!isAdmin) {
      toast('Only the platform admin can authorize NGO wallets.');
      return;
    }
    const normalizedAddress = address.trim();
    if (!isAddress(normalizedAddress)) {
      toast('Enter a valid wallet address.');
      return;
    }
    if (!hasLiveRegistry) {
      if (ngos.some((ngo) => ngo.w.toLowerCase() === normalizedAddress.toLowerCase())) {
        toast('This NGO wallet is already listed.');
        return;
      }
      setNgos((current) => [
        ...current,
        { name: short(normalizedAddress), w: normalizedAddress, st: 'approved' },
      ]);
      toast(`Verified NGO ${short(normalizedAddress)} in the demo.`);
      return;
    }
    try {
      await send('authorizeNGO', [normalizedAddress]);
      await refreshRegistry(account, signerRef.current);
      setNgos((current) => {
        const exists = current.some((ngo) => ngo.w.toLowerCase() === normalizedAddress.toLowerCase());
        return exists
          ? current.map((ngo) => ngo.w.toLowerCase() === normalizedAddress.toLowerCase()
            ? { ...ngo, st: 'approved' }
            : ngo)
          : [...current, { name: short(normalizedAddress), w: normalizedAddress, st: 'approved' }];
      });
      toast(`Verified NGO ${short(normalizedAddress)}.`);
    } catch (error) {
      toast(`Could not verify NGO: ${getErrorMessage(error)}`);
    }
  };

  const pauseCampaign = (campaignId) => {
    const campaign = campaigns.find((item) => item.id === campaignId);
    if (!campaign) return;
    setCampaigns((current) => current.map((item) => (
      item.id === campaignId ? { ...item, paused: !item.paused } : item
    )));
    toast(campaign.paused ? 'Campaign resumed.' : 'Campaign paused. Donations are blocked.');
  };

  const revokeNgo = async (address) => {
    if (!isAdmin) {
      toast('Only the platform admin can revoke NGO wallets.');
      return;
    }
    if (!hasLiveRegistry) {
      setNgos((current) => current.map((ngo) => (
        ngo.w.toLowerCase() === address.toLowerCase() ? { ...ngo, st: 'revoked' } : ngo
      )));
      toast('NGO authorization revoked in the presentation demo.');
      return;
    }
    try {
      await send('revokeNGO', [address]);
      await refreshRegistry(account, signerRef.current);
      setNgos((current) => current.map((ngo) => (
        ngo.w.toLowerCase() === address.toLowerCase() ? { ...ngo, st: 'revoked' } : ngo
      )));
      toast(`Revoked NGO authorization for ${short(address)}.`);
    } catch (error) {
      toast(`Could not revoke NGO authorization: ${getErrorMessage(error)}`);
    }
  };

  const isAdmin = hasLiveRegistry
    ? Boolean(account && registryAdmin && registryAdmin.toLowerCase() === account.toLowerCase())
    : Boolean(account && account.toLowerCase() === demoActors.admin.address.toLowerCase());

  return (
    <div className="wrap">
      <Header
        account={account}
        demo={demo}
        onConnect={connect}
        onEnterDemo={enterDemo}
        onLogout={logout}
        showDemoOption={!demo}
      />
      {demo && (
        <DemoConsole
          account={account}
          onRoleChange={selectDemoRole}
          onReset={resetDemo}
          onLogout={logout}
          onRefreshStorage={() => refreshStorage(true)}
          storage={storage}
        />
      )}
      <main id="app">
        {view === 'portfolio' && (
          <PortfolioPage
            account={account}
            demo={demo}
            campaigns={campaigns}
            votes={activeVotes}
            onConnect={connect}
            onVote={vote}
            onFinalize={finalizeMilestone}
          />
        )}
        {view === 'ngo' && (
          <NgoPage
            account={account}
            demo={demo}
            campaigns={campaigns}
            onConnect={connect}
            onProof={submitProof}
            onClaim={claimSeed}
            onPublish={publish}
            isVerifiedNgo={isVerifiedNgo}
          />
        )}
        {view === 'admin' && (
          <AdminPage
            account={account}
            ngos={ngos}
            campaigns={campaigns}
            isAdmin={isAdmin}
            demo={demo}
            onConnect={connect}
            onNgoStatus={updateNgoStatus}
            onAuthorizeNgo={authorizeNgo}
            onPause={pauseCampaign}
            onRevokeNgo={revokeNgo}
          />
        )}
        {view === 'explore' && (
          <ExplorePage campaigns={campaigns} onDonate={openDonation} simulatedPol={demo} />
        )}
      </main>
      <footer>
        {hasLiveRegistry
          ? 'Live mode is enabled. Transactions use POL on the configured network; receipts and campaign details are stored on IPFS.'
          : 'Presentation mode: every POL amount and transaction is simulated; files and JSON still go through the upload service shown above. Configure PINATA_MODE=pinata and PINATA_JWT to pin to real IPFS.'}
      </footer>
      <DonateDialog
        campaign={donationCampaign}
        onDonate={donate}
        onClose={() => setDonationCampaign(null)}
        simulatedPol={demo}
      />
      <Toast message={toastMessage} visible={toastVisible} />
    </div>
  );
}
