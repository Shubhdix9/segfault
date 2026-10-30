import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserProvider, Contract, formatEther, isAddress, parseEther } from 'ethers';
import Header from './components/Header.jsx';
import ExplorePage from './components/ExplorePage.jsx';
import PortfolioPage from './components/PortfolioPage.jsx';
import NgoPage from './components/NgoPage.jsx';
import AdminPage from './components/AdminPage.jsx';
import DonateDialog from './components/DonateDialog.jsx';
import Toast from './components/Toast.jsx';
import { ABI, CONFIG, initialCampaigns, initialNgos } from './data/WellChain.js';
import { uploadFileToIPFS, uploadJSONToIPFS } from './services/ipfs.js';
import { createReadContract, readRegistry } from './services/registry.js';

const DEMO_ACCOUNT = '0x8F3a7C21d0b94E5a6c10aB3d77e2F09c91bc';
const hasLiveRegistry = Boolean(CONFIG.address);
const availableViews = ['explore', 'portfolio', 'ngo', 'admin'];

function getErrorMessage(error) {
  return error?.reason || error?.shortMessage || error?.message || 'Unknown error';
}

function short(address) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export default function App() {
  const [account, setAccount] = useState(null);
  const [demo, setDemo] = useState(!hasLiveRegistry);
  const [campaigns, setCampaigns] = useState(hasLiveRegistry ? [] : initialCampaigns);
  const [ngos, setNgos] = useState(hasLiveRegistry ? [] : initialNgos);
  const [votes, setVotes] = useState({});
  const [registryAdmin, setRegistryAdmin] = useState('');
  const [view, setView] = useState(() => {
    const initialView = window.location.hash.slice(1);
    return availableViews.includes(initialView) ? initialView : 'explore';
  });
  const [donationCampaign, setDonationCampaign] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef(null);
  const signerRef = useRef(null);

  const toast = useCallback((message) => {
    setToastMessage(message);
    setToastVisible(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 3400);
  }, []);

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
    if (!hasLiveRegistry) return;
    refreshRegistry(null, null).catch((error) => {
      toast(`Could not load the campaign registry: ${getErrorMessage(error)}`);
    });
  }, [refreshRegistry, toast]);

  useEffect(() => {
    const wallet = window.ethereum;
    if (!wallet?.on) return undefined;

    const refreshWalletAccount = async (accounts) => {
      if (!accounts.length) {
        signerRef.current = null;
        setAccount(null);
        setVotes({});
        return;
      }
      try {
        const provider = new BrowserProvider(wallet);
        const activeSigner = await provider.getSigner(accounts[0]);
        const activeAccount = await activeSigner.getAddress();
        signerRef.current = activeSigner;
        setAccount(activeAccount);
        if (hasLiveRegistry) await refreshRegistry(activeAccount, activeSigner);
      } catch (error) {
        toast(`Could not update the connected wallet: ${getErrorMessage(error)}`);
      }
    };

    const handleAccountsChanged = (accounts) => {
      void refreshWalletAccount(accounts);
    };
    const handleChainChanged = (chainId) => {
      if (hasLiveRegistry && Number.parseInt(chainId, 16) !== CONFIG.chainId) {
        signerRef.current = null;
        setAccount(null);
        setVotes({});
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
    if (!window.ethereum) {
      if (hasLiveRegistry) {
        toast('Install a wallet such as MetaMask to connect to the deployed registry.');
        return null;
      }
      setAccount(DEMO_ACCOUNT);
      signerRef.current = null;
      setDemo(true);
      toast('No wallet found. Using a demo wallet.');
      return DEMO_ACCOUNT;
    }

    try {
      const provider = new BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      if (hasLiveRegistry) {
        const desiredChain = `0x${CONFIG.chainId.toString(16)}`;
        try {
          await provider.send('wallet_switchEthereumChain', [{ chainId: desiredChain }]);
        } catch (error) {
          if (error.code !== 4902 || CONFIG.chainId !== 80002) throw error;
          await provider.send('wallet_addEthereumChain', [{
            chainId: desiredChain,
            chainName: 'Polygon Amoy',
            nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
            rpcUrls: [CONFIG.rpcUrl],
            blockExplorerUrls: ['https://amoy.polygonscan.com'],
          }]);
        }
        const network = await provider.getNetwork();
        if (Number(network.chainId) !== CONFIG.chainId) {
          throw new Error(`Switch your wallet to chain ${CONFIG.chainId} and try again.`);
        }
        const code = await provider.getCode(CONFIG.address);
        if (code === '0x') throw new Error('No contract is deployed at VITE_CONTRACT_ADDRESS on this network.');
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
            ? {
              ...campaign,
              raised: campaign.raised + amount,
              mine: campaign.mine + amount,
              canClaimSeed: campaign.seedAmount
                ? campaign.raised + amount >= campaign.seedAmount
                : campaign.canClaimSeed,
            }
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
        const voteKey = `${campaignId}-${milestoneIndex}`;
        const yesVotes = milestone.yes + (yes ? campaign.mine : 0);
        const noVotes = milestone.no + (yes ? 0 : campaign.mine);
        setVotes((current) => ({ ...current, [voteKey]: yes }));
        setCampaigns((current) => current.map((item) => {
          if (item.id !== campaignId) return item;
          const milestones = item.ms.map((entry, index) => {
            const entryIndex = entry.index ?? index;
            if (entryIndex === milestoneIndex) {
              const isApproved = yesVotes > item.raised / 2 && yesVotes > noVotes;
              return { ...entry, yes: yesVotes, no: noVotes, st: isApproved ? 'disbursed' : entry.st };
            }
            if (entryIndex === milestoneIndex + 1 && entry.st === 'locked' && yesVotes > noVotes) {
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
      await send('finalizeMilestone', [campaignId, milestoneIndex]);
      await refreshRegistry(account, signerRef.current);
      toast('Milestone finalized.');
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
        title,
        story: String(formData.get('story') || '').trim(),
        ngoName: short(connectedAccount),
        bannerCid: bannerUpload?.cid || '',
        version: 1,
      };
      const { cid: metadataCid } = await uploadJSONToIPFS(metadata, metadata.title);
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
          ...metadata,
          ngo: metadata.ngoName,
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
    try {
      const { cid } = await uploadFileToIPFS(file);
      await send('submitProof', [campaignId, milestoneIndex, cid]);
      if (hasLiveRegistry) {
        await refreshRegistry(account, signerRef.current);
      } else {
        setCampaigns((current) => current.map((campaign) => (
          campaign.id === campaignId
            ? {
              ...campaign,
              ms: campaign.ms.map((milestone, index) => (
                (milestone.index ?? index) === milestoneIndex
                  ? { ...milestone, st: 'voting', yes: 0, no: 0, proofCid: cid }
                  : milestone
              )),
            }
            : campaign
        )));
      }
      toast('Receipt pinned to IPFS. Donor voting has started.');
    } catch (error) {
      toast(`Could not submit the receipt: ${getErrorMessage(error)}`);
    }
  };

  const claimSeed = async (campaignId, milestoneIndex) => {
    const campaign = campaigns.find((item) => item.id === campaignId);
    if (!campaign) return;
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
      toast('Seed advance sent to your wallet.');
    } catch (error) {
      toast(`Claim failed: ${getErrorMessage(error)}`);
    }
  };

  const updateNgoStatus = (index, status) => {
    setNgos((current) => current.map((ngo, ngoIndex) => (
      ngoIndex === index ? { ...ngo, st: status } : ngo
    )));
    toast(status === 'approved' ? 'NGO verified. It can now start campaigns.' : 'Application rejected.');
  };

  const authorizeNgo = async (address) => {
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

  const isAdmin = hasLiveRegistry
    ? Boolean(account && registryAdmin && registryAdmin.toLowerCase() === account.toLowerCase())
    : demo || Boolean(CONFIG.admin && account && account.toLowerCase() === CONFIG.admin.toLowerCase());

  return (
    <div className="wrap">
      <Header account={account} demo={demo} onConnect={connect} />
      <main id="app">
        {view === 'portfolio' && (
          <PortfolioPage
            account={account}
            demo={demo}
            campaigns={campaigns}
            votes={votes}
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
          />
        )}
        {view === 'explore' && <ExplorePage campaigns={campaigns} onDonate={openDonation} />}
      </main>
      <footer>Polygon Amoy testnet. Receipts and campaign details are stored on IPFS, votes and payouts in the contract. Connect a wallet on the configured network to use the live registry.</footer>
      <DonateDialog
        campaign={donationCampaign}
        onDonate={donate}
        onClose={() => setDonationCampaign(null)}
      />
      <Toast message={toastMessage} visible={toastVisible} />
    </div>
  );
}
