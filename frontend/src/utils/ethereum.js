import { BrowserProvider } from 'ethers';

export const isMetaMaskInstalled = () => {
  return typeof window !== 'undefined' && Boolean(window.ethereum);
};

export const getProvider = () => {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed. Please install MetaMask to connect your wallet.');
  }
  return new BrowserProvider(window.ethereum);
};

export const connectWallet = async () => {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed. Please install MetaMask to connect.');
  }

  const provider = getProvider();
  const accounts = await provider.send('eth_requestAccounts', []);
  const signer = await provider.getSigner();
  const network = await provider.getNetwork();

  return {
    account: accounts[0],
    signer,
    chainId: Number(network.chainId),
  };
};

