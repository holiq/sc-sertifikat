import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Hardhat Ignition deployment module untuk CertificateRegistry.
 *
 * Deploy:
 *   npx hardhat ignition deploy ignition/modules/CertificateRegistry.ts --network sepolia
 *
 * Dry-run lokal:
 *   npx hardhat ignition deploy ignition/modules/CertificateRegistry.ts --network hardhatMainnet
 */
const CertificateRegistryModule = buildModule("CertificateRegistryModule", (m) => {
  const registry = m.contract("CertificateRegistry");

  return { registry };
});

export default CertificateRegistryModule;
