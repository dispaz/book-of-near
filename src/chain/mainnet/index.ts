/** Public entry for lessons and the badge: `import { useMainnetWallet, checkFunds } from "../../../chain/mainnet"`. */
export type * from "./types";
export { checkFunds, DEFAULT_FEE_RESERVE } from "./funds";
export { describeSigning, signWithConfirmation, type SigningOutcome } from "./signing";
export { DemoWallet, DEMO_MAINNET_ACCOUNT, type DemoWalletOptions } from "./DemoWallet";
export {
  FundsNotice,
  MainnetWalletProvider,
  useMainnetWallet,
  WalletPanel,
  type MainnetWalletLoader,
} from "./MainnetWalletContext";
