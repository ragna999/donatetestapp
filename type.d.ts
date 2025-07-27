// src/type.d.ts (atau di root project kalau tidak pakai alias)
import { Eip1193Provider } from 'ethers';

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}
