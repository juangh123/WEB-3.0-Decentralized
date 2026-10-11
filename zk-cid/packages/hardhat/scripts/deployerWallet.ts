/**
 * Resolves the deployer wallet for live operations.
 *
 * Priority:
 *   1. DEPLOYER_PRIVATE_KEY / __RUNTIME_DEPLOYER_PRIVATE_KEY from the shell environment.
 *   2. DEPLOYER_PRIVATE_KEY_ENCRYPTED (an ethers keystore in `packages/hardhat/.env`), unlocked
 *      with an interactive password prompt.
 *
 * The encrypted path lets operators delete the plaintext key from `.env`; create one with
 * `yarn account:generate` or `yarn account:import`.
 */
import password from "@inquirer/password";
import { Wallet, type Provider } from "ethers";

export async function getDeployerWallet(provider: Provider, operation = "operation"): Promise<Wallet> {
  const plaintext = process.env.DEPLOYER_PRIVATE_KEY ?? process.env.__RUNTIME_DEPLOYER_PRIVATE_KEY;
  if (plaintext) {
    return new Wallet(plaintext, provider);
  }

  const encrypted = process.env.DEPLOYER_PRIVATE_KEY_ENCRYPTED;
  if (!encrypted) {
    throw new Error(
      `${operation}: no deployer key available. Set DEPLOYER_PRIVATE_KEY in the shell environment, ` +
        "or run `yarn account:generate` / `yarn account:import` to create the encrypted " +
        "DEPLOYER_PRIVATE_KEY_ENCRYPTED keystore.",
    );
  }

  const pass = await password({ message: "Enter password to decrypt the deployer key:" });
  try {
    const decrypted = await Wallet.fromEncryptedJson(encrypted, pass);
    return decrypted.connect(provider) as Wallet;
  } catch {
    throw new Error(`${operation}: failed to decrypt DEPLOYER_PRIVATE_KEY_ENCRYPTED (wrong password?)`);
  }
}
