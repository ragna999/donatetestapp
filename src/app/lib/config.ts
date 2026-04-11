// ─── Network ─────────────────────────────────────────────────────────────────
// Ganti dengan RPC Sepolia kamu (Infura / Alchemy lebih stabil)
export const RPC =
  process.env.NEXT_PUBLIC_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';

// ─── Contract Addresses ───────────────────────────────────────────────────────
// Isi setelah deploy ke Sepolia
export const FACTORY_ADDRESS =
  process.env.NEXT_PUBLIC_FACTORY_ADDRESS || '0xe5dE718DfFc5f7018d78E039F399c6007f3D4b87';

export const ADMIN_MANAGER_ADDRESS =
  process.env.NEXT_PUBLIC_ADMIN_ADDRESS || '0x32A7569588895061a1A36b8357130381a9Ec194a';
