import {Contract} from '../Contract';
import {Callable, Sendable} from '../Invokation';
import {encodedNumber} from '../Encoding';

interface ComptrollerMethods {
  getAccountLiquidity(string): Callable<{0: number, 1: number, 2: number}>
  getHypotheticalAccountLiquidity(account: string, asset: string, redeemTokens: encodedNumber, borrowAmount: encodedNumber): Callable<{0: number, 1: number, 2: number}>
  membershipLength(string): Callable<string>
  checkMembership(user: string, aToken: string): Callable<string>
  getAssetsIn(string): Callable<string[]>
  admin(): Callable<string>
  oracle(): Callable<string>
  maxAssets(): Callable<number>
  liquidationIncentiveMantissa(): Callable<number>
  closeFactorMantissa(): Callable<number>
  getBlockNumber(): Callable<number>
  collateralFactor(string): Callable<string>
  markets(string): Callable<{0: boolean, 1: number, 2?: boolean}>
  _setMintPaused(bool): Sendable<number>
  _setMaxAssets(encodedNumber): Sendable<number>
  _setLiquidationIncentive(encodedNumber): Sendable<number>
  _supportMarket(string): Sendable<number>
  _setPriceOracle(string): Sendable<number>
  _setCollateralFactor(string, encodedNumber): Sendable<number>
  _setCloseFactor(encodedNumber): Sendable<number>
  enterMarkets(markets: string[]): Sendable<number>
  exitMarket(market: string): Sendable<number>
  fastForward(encodedNumber): Sendable<number>
  _setPendingImplementation(string): Sendable<number>
  comptrollerImplementation(): Callable<string>
  unlist(string): Sendable<void>
  admin(): Callable<string>
  pendingAdmin(): Callable<string>
  _setPendingAdmin(string): Sendable<number>
  _acceptAdmin(): Sendable<number>
  _setPauseGuardian(string): Sendable<number>
  pauseGuardian(): Callable<string>
  _setMintPaused(market: string, string): Sendable<number>
  _setBorrowPaused(market: string, string): Sendable<number>
  _setTransferPaused(string): Sendable<number>
  _setSeizePaused(string): Sendable<number>
  _mintGuardianPaused(): Callable<boolean>
  _borrowGuardianPaused(): Callable<boolean>
  transferGuardianPaused(): Callable<boolean>
  seizeGuardianPaused(): Callable<boolean>
  mintGuardianPaused(market: string): Callable<boolean>
  borrowGuardianPaused(market: string): Callable<boolean>
  _addArsMarkets(markets: string[]): Sendable<void>
  _dropArsMarket(market: string): Sendable<void>
  getArsMarkets(): Callable<string[]>
  refreshArsSpeeds(): Sendable<void>
  arsRate(): Callable<number>
  arsSupplyState(string): Callable<string>
  arsBorrowState(string): Callable<string>
  arsAccrued(string): Callable<string>
  arsReceivable(string): Callable<string>
  arsSupplierIndex(market: string, account: string): Callable<string>
  arsBorrowerIndex(market: string, account: string): Callable<string>
  arsSpeeds(string): Callable<string>
  arsSupplySpeeds(string): Callable<string>
  arsBorrowSpeeds(string): Callable<string>
  claimArs(holder: string): Sendable<void>
  claimArs(holder: string, aTokens: string[]): Sendable<void>
  updateContributorRewards(account: string): Sendable<void>
  _grantArs(account: string, encodedNumber): Sendable<void>
  _setArsRate(encodedNumber): Sendable<void>
  _setArsSpeed(aTokens: string, encodedNumber): Sendable<void>
  _setArsSpeeds(aTokens: string[], supplySpeeds: encodedNumber[], borrowSpeeds: encodedNumber[]): Sendable<void>
  _setContributorArsSpeed(account: string, encodedNumber): Sendable<void>
  _setMarketBorrowCaps(aTokens:string[], borrowCaps:encodedNumber[]): Sendable<void>
  _setBorrowCapGuardian(string): Sendable<void>
  borrowCapGuardian(): Callable<string>
  borrowCaps(string): Callable<string>
  isDeprecated(aToken: string): Callable<string>
}

export interface Comptroller extends Contract {
  methods: ComptrollerMethods
}
