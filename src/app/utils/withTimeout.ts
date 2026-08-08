/**
 * Wrapper untuk promise dengan timeout.
 * Kalau promise ga resolve dalam `ms` milidetik, throw error.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = 'Operasi'): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} terlalu lama (>${ms / 1000}s). Cek Etherscan untuk status transaksi.`));
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Timeout untuk transaksi blockchain (default 60 detik).
 * dua fase: tunggu tx object, lalu tunggu receipt.
 */
export async function waitForTxWithTimeout(
  txPromise: Promise<any>,
  timeoutMs = 60_000,
  label = 'Transaksi'
) {
  const tx = await withTimeout(txPromise, timeoutMs, `${label} — mengirim`);
  const receipt = await withTimeout(tx.wait(), timeoutMs, `${label} — konfirmasi`);
  return receipt;
}
