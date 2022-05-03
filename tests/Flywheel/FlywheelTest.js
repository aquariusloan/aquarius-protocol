const {
  makeComptroller,
  makeAToken,
  balanceOf,
  fastForward,
  pretendBorrow,
  quickMint,
  quickBorrow,
  enterMarkets
} = require('../Utils/Aquarius');
const {
  etherExp,
  etherDouble,
  etherUnsigned,
  etherMantissa
} = require('../Utils/Ethereum');

const arsRate = etherUnsigned(1e18);

const arsInitialIndex = 1e36;

async function arsAccrued(comptroller, user) {
  return etherUnsigned(await call(comptroller, 'arsAccrued', [user]));
}

async function arsBalance(comptroller, user) {
  return etherUnsigned(await call(comptroller.ars, 'balanceOf', [user]))
}

async function totalArsAccrued(comptroller, user) {
  return (await arsAccrued(comptroller, user)).plus(await arsBalance(comptroller, user));
}

describe('Flywheel upgrade', () => {
  describe('becomes the comptroller', () => {
    it('adds the ars markets', async () => {
      let root = saddle.accounts[0];
      let unitroller = await makeComptroller({kind: 'unitroller-g2'});
      let arsMarkets = await Promise.all([1, 2, 3].map(async _ => {
        return makeAToken({comptroller: unitroller, supportMarket: true});
      }));
      arsMarkets = arsMarkets.map(c => c._address);
      unitroller = await makeComptroller({kind: 'unitroller-g3', unitroller, arsMarkets});
      expect(await call(unitroller, 'getArsMarkets')).toEqual(arsMarkets);
    });

    it('adds the other markets', async () => {
      let root = saddle.accounts[0];
      let unitroller = await makeComptroller({kind: 'unitroller-g2'});
      let allMarkets = await Promise.all([1, 2, 3].map(async _ => {
        return makeAToken({comptroller: unitroller, supportMarket: true});
      }));
      allMarkets = allMarkets.map(c => c._address);
      unitroller = await makeComptroller({
        kind: 'unitroller-g3',
        unitroller,
        arsMarkets: allMarkets.slice(0, 1),
        otherMarkets: allMarkets.slice(1)
      });
      expect(await call(unitroller, 'getAllMarkets')).toEqual(allMarkets);
      expect(await call(unitroller, 'getArsMarkets')).toEqual(allMarkets.slice(0, 1));
    });

    it('_supportMarket() adds to all markets, and only once', async () => {
      let root = saddle.accounts[0];
      let unitroller = await makeComptroller({kind: 'unitroller-g3'});
      let allMarkets = [];
      for (let _ of Array(10)) {
        allMarkets.push(await makeAToken({comptroller: unitroller, supportMarket: true}));
      }
      expect(await call(unitroller, 'getAllMarkets')).toEqual(allMarkets.map(c => c._address));
      expect(
        makeComptroller({
          kind: 'unitroller-g3',
          unitroller,
          otherMarkets: [allMarkets[0]._address]
        })
      ).rejects.toRevert('revert market already added');
    });
  });
});

describe('Flywheel', () => {
  let root, a1, a2, a3, accounts;
  let comptroller, cLOW, aREP, aZRX, cEVIL;
  beforeEach(async () => {
    let interestRateModelOpts = {borrowRate: 0.000001};
    [root, a1, a2, a3, ...accounts] = saddle.accounts;
    comptroller = await makeComptroller();
    cLOW = await makeAToken({comptroller, supportMarket: true, underlyingPrice: 1, interestRateModelOpts});
    aREP = await makeAToken({comptroller, supportMarket: true, underlyingPrice: 2, interestRateModelOpts});
    aZRX = await makeAToken({comptroller, supportMarket: true, underlyingPrice: 3, interestRateModelOpts});
    cEVIL = await makeAToken({comptroller, supportMarket: false, underlyingPrice: 3, interestRateModelOpts});
    cUSD = await makeAToken({comptroller, supportMarket: true, underlyingPrice: 1, collateralFactor: 0.5, interestRateModelOpts});
  });

  describe('_grantArs()', () => {
    beforeEach(async () => {
      await send(comptroller.ars, 'transfer', [comptroller._address, etherUnsigned(50e18)], {from: root});
    });

    it('should award ars if called by admin', async () => {
      const tx = await send(comptroller, '_grantArs', [a1, 100]);
      expect(tx).toHaveLog('ArsGranted', {
        recipient: a1,
        amount: 100
      });
    });

    it('should revert if not called by admin', async () => {
      await expect(
        send(comptroller, '_grantArs', [a1, 100], {from: a1})
      ).rejects.toRevert('revert only admin can grant ars');
    });

    it('should revert if insufficient ars', async () => {
      await expect(
        send(comptroller, '_grantArs', [a1, etherUnsigned(1e20)])
      ).rejects.toRevert('revert insufficient ars for grant');
    });
  });

  describe('getArsMarkets()', () => {
    it('should return the ars markets', async () => {
      for (let mkt of [cLOW, aREP, aZRX]) {
        await send(comptroller, '_setArsSpeeds', [[mkt._address], [etherExp(0.5)], [etherExp(0.5)]]);
      }
      expect(await call(comptroller, 'getArsMarkets')).toEqual(
        [cLOW, aREP, aZRX].map((c) => c._address)
      );
    });
  });

  describe('_setArsSpeeds()', () => {
    it('should update market index when calling setArsSpeed', async () => {
      const mkt = aREP;
      await send(comptroller, 'setBlockNumber', [0]);
      await send(mkt, 'harnessSetTotalSupply', [etherUnsigned(10e18)]);

      await send(comptroller, '_setArsSpeeds', [[mkt._address], [etherExp(0.5)], [etherExp(0.5)]]);
      await fastForward(comptroller, 20);
      await send(comptroller, '_setArsSpeeds', [[mkt._address], [etherExp(1)], [etherExp(0.5)]]);

      const {index, block} = await call(comptroller, 'arsSupplyState', [mkt._address]);
      expect(index).toEqualNumber(2e36);
      expect(block).toEqualNumber(20);
    });

    it('should correctly drop a ars market if called by admin', async () => {
      for (let mkt of [cLOW, aREP, aZRX]) {
        await send(comptroller, '_setArsSpeeds', [[mkt._address], [etherExp(0.5)], [etherExp(0.5)]]);
      }
      const tx = await send(comptroller, '_setArsSpeeds', [[cLOW._address], [0], [0]]);
      expect(await call(comptroller, 'getArsMarkets')).toEqual(
        [aREP, aZRX].map((c) => c._address)
      );
      expect(tx).toHaveLog('ArsBorrowSpeedUpdated', {
        aToken: cLOW._address,
        newSpeed: 0
      });
      expect(tx).toHaveLog('ArsSupplySpeedUpdated', {
        aToken: cLOW._address,
        newSpeed: 0
      });
    });

    it('should correctly drop a ars market from middle of array', async () => {
      for (let mkt of [cLOW, aREP, aZRX]) {
        await send(comptroller, '_setArsSpeeds', [[mkt._address], [etherExp(0.5)], [etherExp(0.5)]]);
      }
      await send(comptroller, '_setArsSpeeds', [[aREP._address], [0], [0]]);
      expect(await call(comptroller, 'getArsMarkets')).toEqual(
        [cLOW, aZRX].map((c) => c._address)
      );
    });

    it('should not drop a ars market unless called by admin', async () => {
      for (let mkt of [cLOW, aREP, aZRX]) {
        await send(comptroller, '_setArsSpeeds', [[mkt._address], [etherExp(0.5)], [etherExp(0.5)]]);
      }
      await expect(
        send(comptroller, '_setArsSpeeds', [[cLOW._address], [0], [etherExp(0.5)]], {from: a1})
      ).rejects.toRevert('revert only admin can set ars speed');
    });

    it('should not add non-listed markets', async () => {
      const aBAT = await makeAToken({ comptroller, supportMarket: false });
      await expect(
        send(comptroller, 'harnessAddArsMarkets', [[aBAT._address]])
      ).rejects.toRevert('revert ars market is not listed');

      const markets = await call(comptroller, 'getArsMarkets');
      expect(markets).toEqual([]);
    });
  });

  describe('updateArsBorrowIndex()', () => {
    it('should calculate ars borrower index correctly', async () => {
      const mkt = aREP;
      await send(comptroller, '_setArsSpeeds', [[mkt._address], [etherExp(0.5)], [etherExp(0.5)]]);
      await send(comptroller, 'setBlockNumber', [100]);
      await send(mkt, 'harnessSetTotalBorrows', [etherUnsigned(11e18)]);
      await send(comptroller, 'harnessUpdateArsBorrowIndex', [
        mkt._address,
        etherExp(1.1),
      ]);
      /*
        100 blocks, 10e18 origin total borrows, 0.5e18 borrowSpeed

        borrowAmt   = totalBorrows * 1e18 / borrowIdx
                    = 11e18 * 1e18 / 1.1e18 = 10e18
        arsAccrued = deltaBlocks * borrowSpeed
                    = 100 * 0.5e18 = 50e18
        newIndex   += 1e36 + arsAccrued * 1e36 / borrowAmt
                    = 1e36 + 50e18 * 1e36 / 10e18 = 6e36
      */

      const {index, block} = await call(comptroller, 'arsBorrowState', [mkt._address]);
      expect(index).toEqualNumber(6e36);
      expect(block).toEqualNumber(100);
    });

    it('should not revert or update arsBorrowState index if aToken not in ARS markets', async () => {
      const mkt = await makeAToken({
        comptroller: comptroller,
        supportMarket: true,
        addArsMarket: false,
      });
      await send(comptroller, 'setBlockNumber', [100]);
      await send(comptroller, 'harnessUpdateArsBorrowIndex', [
        mkt._address,
        etherExp(1.1),
      ]);

      const {index, block} = await call(comptroller, 'arsBorrowState', [mkt._address]);
      expect(index).toEqualNumber(arsInitialIndex);
      expect(block).toEqualNumber(100);
      const supplySpeed = await call(comptroller, 'arsSupplySpeeds', [mkt._address]);
      expect(supplySpeed).toEqualNumber(0);
      const borrowSpeed = await call(comptroller, 'arsBorrowSpeeds', [mkt._address]);
      expect(borrowSpeed).toEqualNumber(0);
    });

    it('should not update index if no blocks passed since last accrual', async () => {
      const mkt = aREP;
      await send(comptroller, '_setArsSpeeds', [[mkt._address], [etherExp(0.5)], [etherExp(0.5)]]);
      await send(comptroller, 'harnessUpdateArsBorrowIndex', [
        mkt._address,
        etherExp(1.1),
      ]);

      const {index, block} = await call(comptroller, 'arsBorrowState', [mkt._address]);
      expect(index).toEqualNumber(arsInitialIndex);
      expect(block).toEqualNumber(0);
    });

    it('should not update index if ars speed is 0', async () => {
      const mkt = aREP;
      await send(comptroller, '_setArsSpeeds', [[mkt._address], [etherExp(0.5)], [etherExp(0.5)]]);
      await send(comptroller, 'setBlockNumber', [100]);
      await send(comptroller, '_setArsSpeeds', [[mkt._address], [etherExp(0)], [etherExp(0)]]);
      await send(comptroller, 'harnessUpdateArsBorrowIndex', [
        mkt._address,
        etherExp(1.1),
      ]);

      const {index, block} = await call(comptroller, 'arsBorrowState', [mkt._address]);
      expect(index).toEqualNumber(arsInitialIndex);
      expect(block).toEqualNumber(100);
    });
  });

  describe('updateArsSupplyIndex()', () => {
    it('should calculate ars supplier index correctly', async () => {
      const mkt = aREP;
      await send(comptroller, '_setArsSpeeds', [[mkt._address], [etherExp(0.5)], [etherExp(0.5)]]);
      await send(comptroller, 'setBlockNumber', [100]);
      await send(mkt, 'harnessSetTotalSupply', [etherUnsigned(10e18)]);
      await send(comptroller, 'harnessUpdateArsSupplyIndex', [mkt._address]);
      /*
        suppyTokens = 10e18
        arsAccrued = deltaBlocks * supplySpeed
                    = 100 * 0.5e18 = 50e18
        newIndex   += arsAccrued * 1e36 / supplyTokens
                    = 1e36 + 50e18 * 1e36 / 10e18 = 6e36
      */
      const {index, block} = await call(comptroller, 'arsSupplyState', [mkt._address]);
      expect(index).toEqualNumber(6e36);
      expect(block).toEqualNumber(100);
    });

    it('should not update index on non-ARS markets', async () => {
      const mkt = await makeAToken({
        comptroller: comptroller,
        supportMarket: true,
        addArsMarket: false
      });
      await send(comptroller, 'setBlockNumber', [100]);
      await send(comptroller, 'harnessUpdateArsSupplyIndex', [
        mkt._address
      ]);

      const {index, block} = await call(comptroller, 'arsSupplyState', [mkt._address]);
      expect(index).toEqualNumber(arsInitialIndex);
      expect(block).toEqualNumber(100);
      const supplySpeed = await call(comptroller, 'arsSupplySpeeds', [mkt._address]);
      expect(supplySpeed).toEqualNumber(0);
      const borrowSpeed = await call(comptroller, 'arsBorrowSpeeds', [mkt._address]);
      expect(borrowSpeed).toEqualNumber(0);
      // ctoken could have no ars speed or ars supplier state if not in ars markets
      // this logic could also possibly be implemented in the allowed hook
    });

    it('should not update index if no blocks passed since last accrual', async () => {
      const mkt = aREP;
      await send(comptroller, 'setBlockNumber', [0]);
      await send(mkt, 'harnessSetTotalSupply', [etherUnsigned(10e18)]);
      await send(comptroller, '_setArsSpeeds', [[mkt._address], [etherExp(0.5)], [etherExp(0.5)]]);
      await send(comptroller, 'harnessUpdateArsSupplyIndex', [mkt._address]);

      const {index, block} = await call(comptroller, 'arsSupplyState', [mkt._address]);
      expect(index).toEqualNumber(arsInitialIndex);
      expect(block).toEqualNumber(0);
    });

    it('should not matter if the index is updated multiple times', async () => {
      const arsRemaining = arsRate.multipliedBy(100)
      await send(comptroller, 'harnessAddArsMarkets', [[cLOW._address]]);
      await send(comptroller.ars, 'transfer', [comptroller._address, arsRemaining], {from: root});
      await pretendBorrow(cLOW, a1, 1, 1, 100);
      await send(comptroller, 'harnessRefreshArsSpeeds');

      await quickMint(cLOW, a2, etherUnsigned(10e18));
      await quickMint(cLOW, a3, etherUnsigned(15e18));

      const a2Accrued0 = await totalArsAccrued(comptroller, a2);
      const a3Accrued0 = await totalArsAccrued(comptroller, a3);
      const a2Balance0 = await balanceOf(cLOW, a2);
      const a3Balance0 = await balanceOf(cLOW, a3);

      await fastForward(comptroller, 20);

      const txT1 = await send(cLOW, 'transfer', [a2, a3Balance0.minus(a2Balance0)], {from: a3});

      const a2Accrued1 = await totalArsAccrued(comptroller, a2);
      const a3Accrued1 = await totalArsAccrued(comptroller, a3);
      const a2Balance1 = await balanceOf(cLOW, a2);
      const a3Balance1 = await balanceOf(cLOW, a3);

      await fastForward(comptroller, 10);
      await send(comptroller, 'harnessUpdateArsSupplyIndex', [cLOW._address]);
      await fastForward(comptroller, 10);

      const txT2 = await send(cLOW, 'transfer', [a3, a2Balance1.minus(a3Balance1)], {from: a2});

      const a2Accrued2 = await totalArsAccrued(comptroller, a2);
      const a3Accrued2 = await totalArsAccrued(comptroller, a3);

      expect(a2Accrued0).toEqualNumber(0);
      expect(a3Accrued0).toEqualNumber(0);
      expect(a2Accrued1).not.toEqualNumber(0);
      expect(a3Accrued1).not.toEqualNumber(0);
      expect(a2Accrued1).toEqualNumber(a3Accrued2.minus(a3Accrued1));
      expect(a3Accrued1).toEqualNumber(a2Accrued2.minus(a2Accrued1));

      expect(txT1.gasUsed).toBeLessThan(200000);
      expect(txT1.gasUsed).toBeGreaterThan(140000);
      expect(txT2.gasUsed).toBeLessThan(150000);
      expect(txT2.gasUsed).toBeGreaterThan(100000);
    });
  });

  describe('distributeBorrowerArs()', () => {

    it('should update borrow index checkpoint but not arsAccrued for first time user', async () => {
      const mkt = aREP;
      await send(comptroller, "setArsBorrowState", [mkt._address, etherDouble(6), 10]);
      await send(comptroller, "setArsBorrowerIndex", [mkt._address, root, etherUnsigned(0)]);

      await send(comptroller, "harnessDistributeBorrowerArs", [mkt._address, root, etherExp(1.1)]);
      expect(await call(comptroller, "arsAccrued", [root])).toEqualNumber(0);
      expect(await call(comptroller, "arsBorrowerIndex", [ mkt._address, root])).toEqualNumber(6e36);
    });

    it('should transfer ars and update borrow index checkpoint correctly for repeat time user', async () => {
      const mkt = aREP;
      await send(comptroller.ars, 'transfer', [comptroller._address, etherUnsigned(50e18)], {from: root});
      await send(mkt, "harnessSetAccountBorrows", [a1, etherUnsigned(5.5e18), etherExp(1)]);
      await send(comptroller, "setArsBorrowState", [mkt._address, etherDouble(6), 10]);
      await send(comptroller, "setArsBorrowerIndex", [mkt._address, a1, etherDouble(1)]);

      /*
      * 100 delta blocks, 10e18 origin total borrows, 0.5e18 borrowSpeed => 6e18 arsBorrowIndex
      * this tests that an acct with half the total borrows over that time gets 25e18 ARS
        borrowerAmount = borrowBalance * 1e18 / borrow idx
                       = 5.5e18 * 1e18 / 1.1e18 = 5e18
        deltaIndex     = marketStoredIndex - userStoredIndex
                       = 6e36 - 1e36 = 5e36
        borrowerAccrued= borrowerAmount * deltaIndex / 1e36
                       = 5e18 * 5e36 / 1e36 = 25e18
      */
      const tx = await send(comptroller, "harnessDistributeBorrowerArs", [mkt._address, a1, etherUnsigned(1.1e18)]);
      expect(await arsAccrued(comptroller, a1)).toEqualNumber(25e18);
      expect(await arsBalance(comptroller, a1)).toEqualNumber(0);
      expect(tx).toHaveLog('DistributedBorrowerArs', {
        aToken: mkt._address,
        borrower: a1,
        arsDelta: etherUnsigned(25e18).toFixed(),
        arsBorrowIndex: etherDouble(6).toFixed()
      });
    });

    it('should not transfer ars automatically', async () => {
      const mkt = aREP;
      await send(comptroller.ars, 'transfer', [comptroller._address, etherUnsigned(50e18)], {from: root});
      await send(mkt, "harnessSetAccountBorrows", [a1, etherUnsigned(5.5e17), etherExp(1)]);
      await send(comptroller, "setArsBorrowState", [mkt._address, etherDouble(1.0019), 10]);
      await send(comptroller, "setArsBorrowerIndex", [mkt._address, a1, etherDouble(1)]);
      /*
        borrowerAmount = borrowBalance * 1e18 / borrow idx
                       = 5.5e17 * 1e18 / 1.1e18 = 5e17
        deltaIndex     = marketStoredIndex - userStoredIndex
                       = 1.0019e36 - 1e36 = 0.0019e36
        borrowerAccrued= borrowerAmount * deltaIndex / 1e36
                       = 5e17 * 0.0019e36 / 1e36 = 0.00095e18
        0.00095e18 < arsClaimThreshold of 0.001e18
      */
      await send(comptroller, "harnessDistributeBorrowerArs", [mkt._address, a1, etherExp(1.1)]);
      expect(await arsAccrued(comptroller, a1)).toEqualNumber(0.00095e18);
      expect(await arsBalance(comptroller, a1)).toEqualNumber(0);
    });

    it('should not revert or distribute when called with non-ARS market', async () => {
      const mkt = await makeAToken({
        comptroller: comptroller,
        supportMarket: true,
        addArsMarket: false,
      });

      await send(comptroller, "harnessDistributeBorrowerArs", [mkt._address, a1, etherExp(1.1)]);
      expect(await arsAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await arsBalance(comptroller, a1)).toEqualNumber(0);
      expect(await call(comptroller, 'arsBorrowerIndex', [mkt._address, a1])).toEqualNumber(arsInitialIndex);
    });
  });

  describe('distributeSupplierArs()', () => {
    it('should transfer ars and update supply index correctly for first time user', async () => {
      const mkt = aREP;
      await send(comptroller.ars, 'transfer', [comptroller._address, etherUnsigned(50e18)], {from: root});

      await send(mkt, "harnessSetBalance", [a1, etherUnsigned(5e18)]);
      await send(comptroller, "setArsSupplyState", [mkt._address, etherDouble(6), 10]);
      /*
      * 100 delta blocks, 10e18 total supply, 0.5e18 supplySpeed => 6e18 arsSupplyIndex
      * confirming an acct with half the total supply over that time gets 25e18 ARS:
        supplierAmount  = 5e18
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 6e36 - 1e36 = 5e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e18 * 5e36 / 1e36 = 25e18
      */

      const tx = await send(comptroller, "harnessDistributeAllSupplierArs", [mkt._address, a1]);
      expect(await arsAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await arsBalance(comptroller, a1)).toEqualNumber(25e18);
      expect(tx).toHaveLog('DistributedSupplierArs', {
        aToken: mkt._address,
        supplier: a1,
        arsDelta: etherUnsigned(25e18).toFixed(),
        arsSupplyIndex: etherDouble(6).toFixed()
      });
    });

    it('should update ars accrued and supply index for repeat user', async () => {
      const mkt = aREP;
      await send(comptroller.ars, 'transfer', [comptroller._address, etherUnsigned(50e18)], {from: root});

      await send(mkt, "harnessSetBalance", [a1, etherUnsigned(5e18)]);
      await send(comptroller, "setArsSupplyState", [mkt._address, etherDouble(6), 10]);
      await send(comptroller, "setArsSupplierIndex", [mkt._address, a1, etherDouble(2)])
      /*
        supplierAmount  = 5e18
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 6e36 - 2e36 = 4e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e18 * 4e36 / 1e36 = 20e18
      */

      await send(comptroller, "harnessDistributeAllSupplierArs", [mkt._address, a1]);
      expect(await arsAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await arsBalance(comptroller, a1)).toEqualNumber(20e18);
    });

    it('should not transfer when arsAccrued below threshold', async () => {
      const mkt = aREP;
      await send(comptroller.ars, 'transfer', [comptroller._address, etherUnsigned(50e18)], {from: root});

      await send(mkt, "harnessSetBalance", [a1, etherUnsigned(5e17)]);
      await send(comptroller, "setArsSupplyState", [mkt._address, etherDouble(1.0019), 10]);
      /*
        supplierAmount  = 5e17
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 1.0019e36 - 1e36 = 0.0019e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e17 * 0.0019e36 / 1e36 = 0.00095e18
      */

      await send(comptroller, "harnessDistributeSupplierArs", [mkt._address, a1]);
      expect(await arsAccrued(comptroller, a1)).toEqualNumber(0.00095e18);
      expect(await arsBalance(comptroller, a1)).toEqualNumber(0);
    });

    it('should not revert or distribute when called with non-ARS market', async () => {
      const mkt = await makeAToken({
        comptroller: comptroller,
        supportMarket: true,
        addArsMarket: false,
      });

      await send(comptroller, "harnessDistributeSupplierArs", [mkt._address, a1]);
      expect(await arsAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await arsBalance(comptroller, a1)).toEqualNumber(0);
      expect(await call(comptroller, 'arsBorrowerIndex', [mkt._address, a1])).toEqualNumber(0);
    });

  });

  describe('transferArs', () => {
    it('should transfer ars accrued when amount is above threshold', async () => {
      const arsRemaining = 1000, a1AccruedPre = 100, threshold = 1;
      const arsBalancePre = await arsBalance(comptroller, a1);
      const tx0 = await send(comptroller.ars, 'transfer', [comptroller._address, arsRemaining], {from: root});
      const tx1 = await send(comptroller, 'setArsAccrued', [a1, a1AccruedPre]);
      const tx2 = await send(comptroller, 'harnessTransferArs', [a1, a1AccruedPre, threshold]);
      const a1AccruedPost = await arsAccrued(comptroller, a1);
      const arsBalancePost = await arsBalance(comptroller, a1);
      expect(arsBalancePre).toEqualNumber(0);
      expect(arsBalancePost).toEqualNumber(a1AccruedPre);
    });

    it('should not transfer when ars accrued is below threshold', async () => {
      const arsRemaining = 1000, a1AccruedPre = 100, threshold = 101;
      const arsBalancePre = await call(comptroller.ars, 'balanceOf', [a1]);
      const tx0 = await send(comptroller.ars, 'transfer', [comptroller._address, arsRemaining], {from: root});
      const tx1 = await send(comptroller, 'setArsAccrued', [a1, a1AccruedPre]);
      const tx2 = await send(comptroller, 'harnessTransferArs', [a1, a1AccruedPre, threshold]);
      const a1AccruedPost = await arsAccrued(comptroller, a1);
      const arsBalancePost = await arsBalance(comptroller, a1);
      expect(arsBalancePre).toEqualNumber(0);
      expect(arsBalancePost).toEqualNumber(0);
    });

    it('should not transfer ars if ars accrued is greater than ars remaining', async () => {
      const arsRemaining = 99, a1AccruedPre = 100, threshold = 1;
      const arsBalancePre = await arsBalance(comptroller, a1);
      const tx0 = await send(comptroller.ars, 'transfer', [comptroller._address, arsRemaining], {from: root});
      const tx1 = await send(comptroller, 'setArsAccrued', [a1, a1AccruedPre]);
      const tx2 = await send(comptroller, 'harnessTransferArs', [a1, a1AccruedPre, threshold]);
      const a1AccruedPost = await arsAccrued(comptroller, a1);
      const arsBalancePost = await arsBalance(comptroller, a1);
      expect(arsBalancePre).toEqualNumber(0);
      expect(arsBalancePost).toEqualNumber(0);
    });
  });

  describe('claimArs', () => {
    it('should accrue ars and then transfer ars accrued', async () => {
      const arsRemaining = arsRate.multipliedBy(100), mintAmount = etherUnsigned(12e18), deltaBlocks = 10;
      await send(comptroller.ars, 'transfer', [comptroller._address, arsRemaining], {from: root});
      await pretendBorrow(cLOW, a1, 1, 1, 100);
      await send(comptroller, '_setArsSpeeds', [[cLOW._address], [etherExp(0.5)], [etherExp(0.5)]]);
      await send(comptroller, 'harnessRefreshArsSpeeds');
      const supplySpeed = await call(comptroller, 'arsSupplySpeeds', [cLOW._address]);
      const borrowSpeed = await call(comptroller, 'arsBorrowSpeeds', [cLOW._address]);
      const a2AccruedPre = await arsAccrued(comptroller, a2);
      const arsBalancePre = await arsBalance(comptroller, a2);
      await quickMint(cLOW, a2, mintAmount);
      await fastForward(comptroller, deltaBlocks);
      const tx = await send(comptroller, 'claimArs', [a2]);
      const a2AccruedPost = await arsAccrued(comptroller, a2);
      const arsBalancePost = await arsBalance(comptroller, a2);
      expect(tx.gasUsed).toBeLessThan(500000);
      expect(supplySpeed).toEqualNumber(arsRate);
      expect(borrowSpeed).toEqualNumber(arsRate);
      expect(a2AccruedPre).toEqualNumber(0);
      expect(a2AccruedPost).toEqualNumber(0);
      expect(arsBalancePre).toEqualNumber(0);
      expect(arsBalancePost).toEqualNumber(arsRate.multipliedBy(deltaBlocks).minus(1)); // index is 8333...
    });

    it('should accrue ars and then transfer ars accrued in a single market', async () => {
      const arsRemaining = arsRate.multipliedBy(100), mintAmount = etherUnsigned(12e18), deltaBlocks = 10;
      await send(comptroller.ars, 'transfer', [comptroller._address, arsRemaining], {from: root});
      await pretendBorrow(cLOW, a1, 1, 1, 100);
      await send(comptroller, 'harnessAddArsMarkets', [[cLOW._address]]);
      await send(comptroller, 'harnessRefreshArsSpeeds');
      const supplySpeed = await call(comptroller, 'arsSupplySpeeds', [cLOW._address]);
      const borrowSpeed = await call(comptroller, 'arsBorrowSpeeds', [cLOW._address]);
      const a2AccruedPre = await arsAccrued(comptroller, a2);
      const arsBalancePre = await arsBalance(comptroller, a2);
      await quickMint(cLOW, a2, mintAmount);
      await fastForward(comptroller, deltaBlocks);
      const tx = await send(comptroller, 'claimArs', [a2, [cLOW._address]]);
      const a2AccruedPost = await arsAccrued(comptroller, a2);
      const arsBalancePost = await arsBalance(comptroller, a2);
      expect(tx.gasUsed).toBeLessThan(170000);
      expect(supplySpeed).toEqualNumber(arsRate);
      expect(borrowSpeed).toEqualNumber(arsRate);
      expect(a2AccruedPre).toEqualNumber(0);
      expect(a2AccruedPost).toEqualNumber(0);
      expect(arsBalancePre).toEqualNumber(0);
      expect(arsBalancePost).toEqualNumber(arsRate.multipliedBy(deltaBlocks).minus(1)); // index is 8333...
    });

    it('should claim when ars accrued is below threshold', async () => {
      const arsRemaining = etherExp(1), accruedAmt = etherUnsigned(0.0009e18)
      await send(comptroller.ars, 'transfer', [comptroller._address, arsRemaining], {from: root});
      await send(comptroller, 'setArsAccrued', [a1, accruedAmt]);
      await send(comptroller, 'claimArs', [a1, [cLOW._address]]);
      expect(await arsAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await arsBalance(comptroller, a1)).toEqualNumber(accruedAmt);
    });

    it('should revert when a market is not listed', async () => {
      const cNOT = await makeAToken({comptroller});
      await expect(
        send(comptroller, 'claimArs', [a1, [cNOT._address]])
      ).rejects.toRevert('revert market must be listed');
    });
  });

  describe('claimArs batch', () => {
    it('should revert when claiming ars from non-listed market', async () => {
      const arsRemaining = arsRate.multipliedBy(100), deltaBlocks = 10, mintAmount = etherExp(10);
      await send(comptroller.ars, 'transfer', [comptroller._address, arsRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;

      for(let from of claimAccts) {
        expect(await send(cLOW.underlying, 'harnessSetBalance', [from, mintAmount], { from })).toSucceed();
        send(cLOW.underlying, 'approve', [cLOW._address, mintAmount], { from });
        send(cLOW, 'mint', [mintAmount], { from });
      }

      await pretendBorrow(cLOW, root, 1, 1, etherExp(10));
      await send(comptroller, 'harnessRefreshArsSpeeds');

      await fastForward(comptroller, deltaBlocks);

      await expect(send(comptroller, 'claimArs', [claimAccts, [cLOW._address, cEVIL._address], true, true])).rejects.toRevert('revert market must be listed');
    });

    it('should claim the expected amount when holders and ctokens arg is duplicated', async () => {
      const arsRemaining = arsRate.multipliedBy(100), deltaBlocks = 10, mintAmount = etherExp(10);
      await send(comptroller.ars, 'transfer', [comptroller._address, arsRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;
      for(let from of claimAccts) {
        expect(await send(cLOW.underlying, 'harnessSetBalance', [from, mintAmount], { from })).toSucceed();
        send(cLOW.underlying, 'approve', [cLOW._address, mintAmount], { from });
        send(cLOW, 'mint', [mintAmount], { from });
      }
      await pretendBorrow(cLOW, root, 1, 1, etherExp(10));
      await send(comptroller, 'harnessAddArsMarkets', [[cLOW._address]]);
      await send(comptroller, 'harnessRefreshArsSpeeds');

      await fastForward(comptroller, deltaBlocks);

      const tx = await send(comptroller, 'claimArs', [[...claimAccts, ...claimAccts], [cLOW._address, cLOW._address], false, true]);
      // ars distributed => 10e18
      for(let acct of claimAccts) {
        expect(await call(comptroller, 'arsSupplierIndex', [cLOW._address, acct])).toEqualNumber(etherDouble(1.125));
        expect(await arsBalance(comptroller, acct)).toEqualNumber(etherExp(1.25));
      }
    });

    it('claims ars for multiple suppliers only', async () => {
      const arsRemaining = arsRate.multipliedBy(100), deltaBlocks = 10, mintAmount = etherExp(10);
      await send(comptroller.ars, 'transfer', [comptroller._address, arsRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;
      for(let from of claimAccts) {
        expect(await send(cLOW.underlying, 'harnessSetBalance', [from, mintAmount], { from })).toSucceed();
        send(cLOW.underlying, 'approve', [cLOW._address, mintAmount], { from });
        send(cLOW, 'mint', [mintAmount], { from });
      }
      await pretendBorrow(cLOW, root, 1, 1, etherExp(10));
      await send(comptroller, 'harnessAddArsMarkets', [[cLOW._address]]);
      await send(comptroller, 'harnessRefreshArsSpeeds');

      await fastForward(comptroller, deltaBlocks);

      const tx = await send(comptroller, 'claimArs', [claimAccts, [cLOW._address], false, true]);
      // ars distributed => 10e18
      for(let acct of claimAccts) {
        expect(await call(comptroller, 'arsSupplierIndex', [cLOW._address, acct])).toEqualNumber(etherDouble(1.125));
        expect(await arsBalance(comptroller, acct)).toEqualNumber(etherExp(1.25));
      }
    });

    it('claims ars for multiple borrowers only, primes uninitiated', async () => {
      const arsRemaining = arsRate.multipliedBy(100), deltaBlocks = 10, mintAmount = etherExp(10), borrowAmt = etherExp(1), borrowIdx = etherExp(1)
      await send(comptroller.ars, 'transfer', [comptroller._address, arsRemaining], {from: root});
      let [_,__, ...claimAccts] = saddle.accounts;

      for(let acct of claimAccts) {
        await send(cLOW, 'harnessIncrementTotalBorrows', [borrowAmt]);
        await send(cLOW, 'harnessSetAccountBorrows', [acct, borrowAmt, borrowIdx]);
      }
      await send(comptroller, 'harnessAddArsMarkets', [[cLOW._address]]);
      await send(comptroller, 'harnessRefreshArsSpeeds');

      await send(comptroller, 'harnessFastForward', [10]);

      const tx = await send(comptroller, 'claimArs', [claimAccts, [cLOW._address], true, false]);
      for(let acct of claimAccts) {
        expect(await call(comptroller, 'arsBorrowerIndex', [cLOW._address, acct])).toEqualNumber(etherDouble(2.25));
        expect(await call(comptroller, 'arsSupplierIndex', [cLOW._address, acct])).toEqualNumber(0);
      }
    });

    it('should revert when a market is not listed', async () => {
      const cNOT = await makeAToken({comptroller});
      await expect(
        send(comptroller, 'claimArs', [[a1, a2], [cNOT._address], true, true])
      ).rejects.toRevert('revert market must be listed');
    });
  });

  describe('harnessRefreshArsSpeeds', () => {
    it('should start out 0', async () => {
      await send(comptroller, 'harnessRefreshArsSpeeds');
      const supplySpeed = await call(comptroller, 'arsSupplySpeeds', [cLOW._address]);
      const borrowSpeed = await call(comptroller, 'arsBorrowSpeeds', [cLOW._address]);
      expect(supplySpeed).toEqualNumber(0);
      expect(borrowSpeed).toEqualNumber(0);
    });

    it('should get correct speeds with borrows', async () => {
      await pretendBorrow(cLOW, a1, 1, 1, 100);
      await send(comptroller, 'harnessAddArsMarkets', [[cLOW._address]]);
      const tx = await send(comptroller, 'harnessRefreshArsSpeeds');
      const supplySpeed = await call(comptroller, 'arsSupplySpeeds', [cLOW._address]);
      const borrowSpeed = await call(comptroller, 'arsBorrowSpeeds', [cLOW._address]);
      expect(supplySpeed).toEqualNumber(arsRate);
      expect(borrowSpeed).toEqualNumber(arsRate);
      expect(tx).toHaveLog(['ArsBorrowSpeedUpdated', 0], {
        aToken: cLOW._address,
        newSpeed: borrowSpeed
      });
      expect(tx).toHaveLog(['ArsSupplySpeedUpdated', 0], {
        aToken: cLOW._address,
        newSpeed: supplySpeed
      });
    });

    it('should get correct speeds for 2 assets', async () => {
      await pretendBorrow(cLOW, a1, 1, 1, 100);
      await pretendBorrow(aZRX, a1, 1, 1, 100);
      await send(comptroller, 'harnessAddArsMarkets', [[cLOW._address, aZRX._address]]);
      await send(comptroller, 'harnessRefreshArsSpeeds');
      const supplySpeed1 = await call(comptroller, 'arsSupplySpeeds', [cLOW._address]);
      const borrowSpeed1 = await call(comptroller, 'arsBorrowSpeeds', [cLOW._address]);
      const supplySpeed2 = await call(comptroller, 'arsSupplySpeeds', [aREP._address]);
      const borrowSpeed2 = await call(comptroller, 'arsBorrowSpeeds', [aREP._address]);
      const supplySpeed3 = await call(comptroller, 'arsSupplySpeeds', [aZRX._address]);
      const borrowSpeed3 = await call(comptroller, 'arsBorrowSpeeds', [aZRX._address]);
      expect(supplySpeed1).toEqualNumber(arsRate.dividedBy(4));
      expect(borrowSpeed1).toEqualNumber(arsRate.dividedBy(4));
      expect(supplySpeed2).toEqualNumber(0);
      expect(borrowSpeed2).toEqualNumber(0);
      expect(supplySpeed3).toEqualNumber(arsRate.dividedBy(4).multipliedBy(3));
      expect(borrowSpeed3).toEqualNumber(arsRate.dividedBy(4).multipliedBy(3));
    });
  });

  describe('harnessSetArsSpeeds', () => {
    it('should correctly set differing ARS supply and borrow speeds', async () => {
      const desiredArsSupplySpeed = 3;
      const desiredArsBorrowSpeed = 20;
      await send(comptroller, 'harnessAddArsMarkets', [[cLOW._address]]);
      const tx = await send(comptroller, '_setArsSpeeds', [[cLOW._address], [desiredArsSupplySpeed], [desiredArsBorrowSpeed]]);
      expect(tx).toHaveLog(['ArsBorrowSpeedUpdated', 0], {
        aToken: cLOW._address,
        newSpeed: desiredArsBorrowSpeed
      });
      expect(tx).toHaveLog(['ArsSupplySpeedUpdated', 0], {
        aToken: cLOW._address,
        newSpeed: desiredArsSupplySpeed
      });
      const currentArsSupplySpeed = await call(comptroller, 'arsSupplySpeeds', [cLOW._address]);
      const currentArsBorrowSpeed = await call(comptroller, 'arsBorrowSpeeds', [cLOW._address]);
      expect(currentArsSupplySpeed).toEqualNumber(desiredArsSupplySpeed);
      expect(currentArsBorrowSpeed).toEqualNumber(desiredArsBorrowSpeed);
    });

    it('should correctly get differing ARS supply and borrow speeds for 4 assets', async () => {
      const aBAT = await makeAToken({ comptroller, supportMarket: true });
      const aDAI = await makeAToken({ comptroller, supportMarket: true });

      const borrowSpeed1 = 5;
      const supplySpeed1 = 10;

      const borrowSpeed2 = 0;
      const supplySpeed2 = 100;

      const borrowSpeed3 = 0;
      const supplySpeed3 = 0;

      const borrowSpeed4 = 13;
      const supplySpeed4 = 0;

      await send(comptroller, 'harnessAddArsMarkets', [[aREP._address, aZRX._address, aBAT._address, aDAI._address]]);
      await send(comptroller, '_setArsSpeeds', [[aREP._address, aZRX._address, aBAT._address, aDAI._address], [supplySpeed1, supplySpeed2, supplySpeed3, supplySpeed4], [borrowSpeed1, borrowSpeed2, borrowSpeed3, borrowSpeed4]]);

      const currentSupplySpeed1 = await call(comptroller, 'arsSupplySpeeds', [aREP._address]);
      const currentBorrowSpeed1 = await call(comptroller, 'arsBorrowSpeeds', [aREP._address]);
      const currentSupplySpeed2 = await call(comptroller, 'arsSupplySpeeds', [aZRX._address]);
      const currentBorrowSpeed2 = await call(comptroller, 'arsBorrowSpeeds', [aZRX._address]);
      const currentSupplySpeed3 = await call(comptroller, 'arsSupplySpeeds', [aBAT._address]);
      const currentBorrowSpeed3 = await call(comptroller, 'arsBorrowSpeeds', [aBAT._address]);
      const currentSupplySpeed4 = await call(comptroller, 'arsSupplySpeeds', [aDAI._address]);
      const currentBorrowSpeed4 = await call(comptroller, 'arsBorrowSpeeds', [aDAI._address]);

      expect(currentSupplySpeed1).toEqualNumber(supplySpeed1);
      expect(currentBorrowSpeed1).toEqualNumber(borrowSpeed1);
      expect(currentSupplySpeed2).toEqualNumber(supplySpeed2);
      expect(currentBorrowSpeed2).toEqualNumber(borrowSpeed2);
      expect(currentSupplySpeed3).toEqualNumber(supplySpeed3);
      expect(currentBorrowSpeed3).toEqualNumber(borrowSpeed3);
      expect(currentSupplySpeed4).toEqualNumber(supplySpeed4);
      expect(currentBorrowSpeed4).toEqualNumber(borrowSpeed4);
    });

    const checkAccrualsBorrowAndSupply = async (arsSupplySpeed, arsBorrowSpeed) => {
      const mintAmount = etherUnsigned(1000e18), borrowAmount = etherUnsigned(1e18), borrowCollateralAmount = etherUnsigned(1000e18), arsRemaining = arsRate.multipliedBy(100), deltaBlocks = 10;

      // Transfer ARS to the comptroller
      await send(comptroller.ars, 'transfer', [comptroller._address, arsRemaining], {from: root});

      // Setup comptroller
      await send(comptroller, 'harnessAddArsMarkets', [[cLOW._address, cUSD._address]]);

      // Set ars speeds to 0 while we setup
      await send(comptroller, '_setArsSpeeds', [[cLOW._address, cUSD._address], [0, 0], [0, 0]]);

      // a2 - supply
      await quickMint(cLOW, a2, mintAmount); // a2 is the supplier

      // a1 - borrow (with supplied collateral)
      await quickMint(cUSD, a1, borrowCollateralAmount);
      await enterMarkets([cUSD], a1);
      await quickBorrow(cLOW, a1, borrowAmount); // a1 is the borrower

      // Initialize ars speeds
      await send(comptroller, '_setArsSpeeds', [[cLOW._address], [arsSupplySpeed], [arsBorrowSpeed]]);

      // Get initial ARS balances
      const a1TotalArsPre = await totalArsAccrued(comptroller, a1);
      const a2TotalArsPre = await totalArsAccrued(comptroller, a2);

      // Start off with no ARS accrued and no ARS balance
      expect(a1TotalArsPre).toEqualNumber(0);
      expect(a2TotalArsPre).toEqualNumber(0);

      // Fast forward blocks
      await fastForward(comptroller, deltaBlocks);

      // Accrue ARS
      await send(comptroller, 'claimArs', [[a1, a2], [cLOW._address], true, true]);

      // Get accrued ARS balances
      const a1TotalArsPost = await totalArsAccrued(comptroller, a1);
      const a2TotalArsPost = await totalArsAccrued(comptroller, a2);

      // check accrual for borrow
      expect(a1TotalArsPost).toEqualNumber(Number(arsBorrowSpeed) > 0 ? arsBorrowSpeed.multipliedBy(deltaBlocks).minus(1) : 0);

      // check accrual for supply
      expect(a2TotalArsPost).toEqualNumber(Number(arsSupplySpeed) > 0 ? arsSupplySpeed.multipliedBy(deltaBlocks) : 0);
    };

    it('should accrue ars correctly with only supply-side rewards', async () => {
      await checkAccrualsBorrowAndSupply(/* supply speed */ etherExp(0.5), /* borrow speed */ 0);
    });

    it('should accrue ars correctly with only borrow-side rewards', async () => {
      await checkAccrualsBorrowAndSupply(/* supply speed */ 0, /* borrow speed */ etherExp(0.5));
    });
  });

  describe('harnessAddArsMarkets', () => {
    it('should correctly add a ars market if called by admin', async () => {
      const aBAT = await makeAToken({comptroller, supportMarket: true});
      const tx1 = await send(comptroller, 'harnessAddArsMarkets', [[cLOW._address, aREP._address, aZRX._address]]);
      const tx2 = await send(comptroller, 'harnessAddArsMarkets', [[aBAT._address]]);
      const markets = await call(comptroller, 'getArsMarkets');
      expect(markets).toEqual([cLOW, aREP, aZRX, aBAT].map((c) => c._address));
      expect(tx2).toHaveLog('ArsBorrowSpeedUpdated', {
        aToken: aBAT._address,
        newSpeed: 1
      });
      expect(tx2).toHaveLog('ArsSupplySpeedUpdated', {
        aToken: aBAT._address,
        newSpeed: 1
      });
    });

    it('should not write over a markets existing state', async () => {
      const mkt = cLOW._address;
      const bn0 = 10, bn1 = 20;
      const idx = etherUnsigned(1.5e36);

      await send(comptroller, "harnessAddArsMarkets", [[mkt]]);
      await send(comptroller, "setArsSupplyState", [mkt, idx, bn0]);
      await send(comptroller, "setArsBorrowState", [mkt, idx, bn0]);
      await send(comptroller, "setBlockNumber", [bn1]);
      await send(comptroller, "_setArsSpeeds", [[mkt], [0], [0]]);
      await send(comptroller, "harnessAddArsMarkets", [[mkt]]);

      const supplyState = await call(comptroller, 'arsSupplyState', [mkt]);
      expect(supplyState.block).toEqual(bn1.toString());
      expect(supplyState.index).toEqual(idx.toFixed());

      const borrowState = await call(comptroller, 'arsBorrowState', [mkt]);
      expect(borrowState.block).toEqual(bn1.toString());
      expect(borrowState.index).toEqual(idx.toFixed());
    });
  });


  describe('updateContributorRewards', () => {
    it('should not fail when contributor rewards called on non-contributor', async () => {
      const tx1 = await send(comptroller, 'updateContributorRewards', [a1]);
    });

    it('should accrue ars to contributors', async () => {
      const tx1 = await send(comptroller, '_setContributorArsSpeed', [a1, 2000]);
      await fastForward(comptroller, 50);

      const a1Accrued = await arsAccrued(comptroller, a1);
      expect(a1Accrued).toEqualNumber(0);

      const tx2 = await send(comptroller, 'updateContributorRewards', [a1], {from: a1});
      const a1Accrued2 = await arsAccrued(comptroller, a1);
      expect(a1Accrued2).toEqualNumber(50 * 2000);
    });

    it('should accrue ars with late set', async () => {
      await fastForward(comptroller, 1000);
      const tx1 = await send(comptroller, '_setContributorArsSpeed', [a1, 2000]);
      await fastForward(comptroller, 50);

      const tx2 = await send(comptroller, 'updateContributorRewards', [a1], {from: a1});
      const a1Accrued2 = await arsAccrued(comptroller, a1);
      expect(a1Accrued2).toEqualNumber(50 * 2000);
    });
  });

  describe('_setContributorArsSpeed', () => {
    it('should revert if not called by admin', async () => {
      await expect(
        send(comptroller, '_setContributorArsSpeed', [a1, 1000], {from: a1})
      ).rejects.toRevert('revert only admin can set ars speed');
    });

    it('should start ars stream if called by admin', async () => {
      const tx = await send(comptroller, '_setContributorArsSpeed', [a1, 1000]);
      expect(tx).toHaveLog('ContributorArsSpeedUpdated', {
        contributor: a1,
        newSpeed: 1000
      });
    });

    it('should reset ars stream if set to 0', async () => {
      const tx1 = await send(comptroller, '_setContributorArsSpeed', [a1, 2000]);
      await fastForward(comptroller, 50);

      const tx2 = await send(comptroller, '_setContributorArsSpeed', [a1, 0]);
      await fastForward(comptroller, 50);

      const tx3 = await send(comptroller, 'updateContributorRewards', [a1], {from: a1});
      const a1Accrued = await arsAccrued(comptroller, a1);
      expect(a1Accrued).toEqualNumber(50 * 2000);
    });
  });
});
