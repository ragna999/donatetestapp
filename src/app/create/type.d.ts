import type { ExternalProvider } from 'ethers';

interface Ethereum extends ExternalProvider {}

interface Window {
  ethereum?: Ethereum;
}
