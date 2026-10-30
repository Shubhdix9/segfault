import { useEffect, useRef, useState } from 'react';
import { BrowserProvider, Contract, parseEther } from 'ethers';
import Header from './components/Header.jsx';
import ExplorePage from './components/ExplorePage.jsx';
import PortfolioPage from './components/PortfolioPage.jsx';
import NgoPage from './components/NgoPage.jsx';
import AdminPage from './components/AdminPage.jsx';
import DonateDialog from './components/DonateDialog.jsx';
import Toast from './components/Toast.jsx';
import { ABI, CONFIG, initialCampaigns, initialNgos } from './data/aquachain.js';

const DEMO_ACCOUNT = '0x8F3a7C21d0b94E5a6c10aB3d77e2F09c91bc';

function getErrorMessage(error) {
  return error?.reason || error?.message || 'unknown error';
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export default function App() {
  const [account, setAccount] = useState(null);
  const [signer, setSigner] = useState(null);
  const [demo, setDemo] = useState(true);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [ngos, setNgos] = useState(initialNgos);
  const [votes, setVotes] = useState({});
  const [view, setView] = useState(() => {
    const initialView = window.location.hash.slice(1);
    return ['explore', 'portfolio', 'ngo', 'admin'].includes(initialView) ? initialView : 'explore';
  });
  const [donationCampaign, setDonationCampaign] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef(null);

  useEffect(() => {
    const handleHashChange = () => {
      const nextView = window.location.hash.slice(1);
      setView(['explore', 'portfolio', 'ngo', 'admin'].includes(nextView) ? nextView : 'explore');
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const toast = (message) => {
    setToastMessage(message);
    setToastVisible(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 3400);
  };

  const connect = async () => {
    if (window.ethereum) {
      try {
        const provider = new BrowserProvider(window.ethereum);
        await provider.send('eth_requestAccounts', []);
        try {
          await provider.send('wallet_switchEthereumChain', [{ chainId: '0x13882' }]);
        } catch {
          await provider.send('wallet_addEthereumChain', [{
            chainId: '0x13882',
            chainName: 'Polygon Amoy',
            nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
            rpcUrls: ['https://rpc-amoy.polygon.technology'],
            blockExplorerUrls: ['https://amoy.polygonscan.com'],
          }]);
        }
        const connectedSigner = await provider.getSigner();
        const connectedAccount = await connectedSigner.getAddress();
        setSigner(connectedSigner);
        setAccount(connectedAccount);
        setDemo(!CONFIG.address);
        return connectedAccount;
      } catch {
        toast('Wallet connection was cancelled.');
        return null;
      }
    }

    setAccount(DEMO_ACCOUNT);
    setSigner(null);
    setDemo(true);
    toast('No wallet found. Using a demo wallet.');
    return DEMO_ACCOUNT;
  };

  const send = async (functionName, args, value) => {
    if (CONFIG.address && signer) {
      const contract = new Contract(CONFIG.address, ABI, signer);
      const transaction = await contract[functionName](
        ...args,
        value ? { value: parseEther(String(value)) } : {},
      );
      toast('Sent. Waiting for confirmation.');
      await transaction.wait();
      return;
    }
    await wait(500);
  };

  const ensureConnected = async () => account || await connect();

  const openDonation = (campaign) => {
    if (campaign.paused) {
      toast('The platform has paused this campaign.');
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
      setCampaigns((current) => current.map((campaign) => (
        campaign.id === donationCampaign.id
          ? { ...campaign, raised: campaign.raised + amount, mine: campaign.mine + amount }
          : campaign
      )));
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
    const milestone = campaign.ms[milestoneIndex];
    try {
      await send('voteOnMilestone', [campaignId, milestoneIndex, yes]);
    } catch (error) {
      toast(`Vote failed: ${getErrorMessage(error)}`);
      return;
    }

    const voteKey = `${campaignId}-${milestoneIndex}`;
    setVotes((current) => ({ ...current, [voteKey]: yes }));
    const yesVotes = milestone.yes + (yes ? campaign.mine : 0);
    const noVotes = milestone.no + (yes ? 0 : campaign.mine);
    let payoutSent = false;
    if (yesVotes > campaign.raised / 2 && yesVotes > noVotes) {
      setCampaigns((current) => current.map((item) => {
        if (item.id !== campaignId) return item;
        const milestones = item.ms.map((entry, index) => {
          if (index === milestoneIndex) return { ...entry, yes: yesVotes, no: noVotes, st: 'disbursed' };
          if (index === milestoneIndex + 1 && entry.st === 'locked') return { ...entry, st: 'pending' };
          return entry;
        });
        return { ...item, ms: milestones };
      }));
      payoutSent = true;
    } else {
      setCampaigns((current) => current.map((item) => {
        if (item.id !== campaignId) return item;
        return {
          ...item,
          ms: item.ms.map((entry, index) => index === milestoneIndex
            ? { ...entry, yes: yesVotes, no: noVotes }
            : entry),
        };
      }));
    }

    toast(yes ? 'You approved this payout.' : 'You flagged this receipt.');
    if (payoutSent) toast('More than half of all funds approved. Payout sent.');
  };

  const publish = async (event, milestoneCount, resetMilestoneCount) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const milestones = Array.from({ length: milestoneCount }, (_, index) => ({
      n: formData.get(`md${index}`),
      amt: Number(formData.get(`ma${index}`)),
      st: index ? 'locked' : 'pending',
    }));
    const target = Number(formData.get('target'));

    const connectedAddress = await ensureConnected();
    if (!connectedAddress) return;
    if (milestones.reduce((sum, milestone) => sum + milestone.amt, 0) > target) {
      toast('Milestones add up to more than your target.');
      return;
    }

    try {
      await send('createCampaign', [
        'ipfs-pending',
        target,
        Number(formData.get('seed')),
        milestones.map((milestone) => milestone.n),
        milestones.map((milestone) => milestone.amt),
      ]);
    } catch (error) {
      toast(`Could not publish: ${getErrorMessage(error)}`);
      return;
    }

    setCampaigns((current) => [{
      id: current.length + 1,
      title: formData.get('title'),
      ngo: `${connectedAddress.slice(0, 6)}…${connectedAddress.slice(-4)}`,
      own: true,
      raised: 0,
      target,
      mine: 0,
      ms: milestones,
    }, ...current]);
    resetMilestoneCount();
    form.reset();
    toast('Campaign published.');
  };

  const submitProof = async (campaignId, milestoneIndex, file) => {
    if (!file) {
      toast('Choose the receipt photo or PDF first.');
      return;
    }
    try {
      await send('submitProof', [campaignId, milestoneIndex, `bafy-demo-${file.name}`]);
    } catch (error) {
      toast(`Could not submit: ${getErrorMessage(error)}`);
      return;
    }
    setCampaigns((current) => current.map((campaign) => (
      campaign.id === campaignId
        ? {
          ...campaign,
          ms: campaign.ms.map((milestone, index) => (
            index === milestoneIndex ? { ...milestone, st: 'voting', yes: 0, no: 0 } : milestone
          )),
        }
        : campaign
    )));
    toast('Receipt submitted. Donors have 24 hours to vote.');
  };

  const claimSeed = async (campaignId, milestoneIndex) => {
    const campaign = campaigns.find((item) => item.id === campaignId);
    const milestone = campaign.ms[milestoneIndex];
    if (campaign.raised < milestone.amt) {
      toast(`The seed advance unlocks at ${milestone.amt} POL raised.`);
      return;
    }
    try {
      await send('claimSeedAdvance', [campaignId]);
    } catch (error) {
      toast(`Claim failed: ${getErrorMessage(error)}`);
      return;
    }
    setCampaigns((current) => current.map((item) => {
      if (item.id !== campaignId) return item;
      return {
        ...item,
        ms: item.ms.map((entry, index) => {
          if (index === milestoneIndex) return { ...entry, st: 'disbursed' };
          if (index === milestoneIndex + 1 && entry.st === 'locked') return { ...entry, st: 'pending' };
          return entry;
        }),
      };
    }));
    toast('Seed advance sent to your wallet.');
  };

  const updateNgoStatus = (index, status) => {
    setNgos((current) => current.map((ngo, ngoIndex) => (
      ngoIndex === index ? { ...ngo, st: status } : ngo
    )));
    toast(status === 'approved' ? 'NGO verified. It can now start campaigns.' : 'Application rejected.');
  };

  const pauseCampaign = (campaignId) => {
    const campaign = campaigns.find((item) => item.id === campaignId);
    setCampaigns((current) => current.map((item) => (
      item.id === campaignId ? { ...item, paused: !item.paused } : item
    )));
    toast(campaign.paused ? 'Campaign resumed.' : 'Campaign paused. Donations are blocked.');
  };

  const isAdmin = demo || Boolean(
    CONFIG.admin && account && account.toLowerCase() === CONFIG.admin.toLowerCase(),
  );

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
            onConnect={connect}
            onNgoStatus={updateNgoStatus}
            onPause={pauseCampaign}
          />
        )}
        {view === 'explore' && <ExplorePage campaigns={campaigns} onDonate={openDonation} />}
      </main>
      <footer>Polygon Amoy testnet. Receipts are stored on IPFS, votes and payouts in the contract. Until a contract address is set in the page config, this runs as a local demo.</footer>
      <DonateDialog
        campaign={donationCampaign}
        onDonate={donate}
        onClose={() => setDonationCampaign(null)}
      />
      <Toast message={toastMessage} visible={toastVisible} />
    </div>
  );
}
