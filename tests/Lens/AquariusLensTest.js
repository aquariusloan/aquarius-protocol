const {
  address,
  encodeParameters,
  etherExp,
} = require('../Utils/Ethereum');
const {
  makeComptroller,
  makeAToken,
} = require('../Utils/Aquarius');

function cullTuple(tuple) {
  return Object.keys(tuple).reduce((acc, key) => {
    if (Number.isNaN(Number(key))) {
      return {
        ...acc,
        [key]: tuple[key]
      };
    } else {
      return acc;
    }
  }, {});
}

describe('AquariusLens', () => {
  let aquariusLens;
  let acct;

  beforeEach(async () => {
    aquariusLens = await deploy('AquariusLens');
    acct = accounts[0];
  });

  describe('aTokenMetadata', () => {
    it('is correct for a aErc20', async () => {
      let aErc20 = await makeAToken();
      expect(
        cullTuple(await call(aquariusLens, 'aTokenMetadata', [aErc20._address]))
      ).toEqual(
        {
          aToken: aErc20._address,
          exchangeRateCurrent: "1000000000000000000",
          supplyRatePerBlock: "0",
          borrowRatePerBlock: "0",
          reserveFactorMantissa: "0",
          totalBorrows: "0",
          totalReserves: "0",
          totalSupply: "0",
          totalCash: "0",
          isListed:false,
          collateralFactorMantissa: "0",
          underlyingAssetAddress: await call(aErc20, 'underlying', []),
          aTokenDecimals: "8",
          underlyingDecimals: "18",
          arsSupplySpeed: "0",
          arsBorrowSpeed: "0",
          borrowCap: "0",
        }
      );
    });

    it('is correct for cEth', async () => {
      let cEth = await makeAToken({kind: 'cether'});
      expect(
        cullTuple(await call(aquariusLens, 'aTokenMetadata', [cEth._address]))
      ).toEqual({
        borrowRatePerBlock: "0",
        aToken: cEth._address,
        aTokenDecimals: "8",
        collateralFactorMantissa: "0",
        exchangeRateCurrent: "1000000000000000000",
        isListed: false,
        reserveFactorMantissa: "0",
        supplyRatePerBlock: "0",
        totalBorrows: "0",
        totalCash: "0",
        totalReserves: "0",
        totalSupply: "0",
        underlyingAssetAddress: "0x0000000000000000000000000000000000000000",
        underlyingDecimals: "18",
        arsSupplySpeed: "0",
        arsBorrowSpeed: "0",
        borrowCap: "0",
      });
    });
    it('is correct for aErc20 with set ars speeds', async () => {
      let comptroller = await makeComptroller();
      let aErc20 = await makeAToken({comptroller, supportMarket: true});
      await send(comptroller, '_setArsSpeeds', [[aErc20._address], [etherExp(0.25)], [etherExp(0.75)]]);
      expect(
        cullTuple(await call(aquariusLens, 'aTokenMetadata', [aErc20._address]))
      ).toEqual(
        {
          aToken: aErc20._address,
          exchangeRateCurrent: "1000000000000000000",
          supplyRatePerBlock: "0",
          borrowRatePerBlock: "0",
          reserveFactorMantissa: "0",
          totalBorrows: "0",
          totalReserves: "0",
          totalSupply: "0",
          totalCash: "0",
          isListed: true,
          collateralFactorMantissa: "0",
          underlyingAssetAddress: await call(aErc20, 'underlying', []),
          aTokenDecimals: "8",
          underlyingDecimals: "18",
          arsSupplySpeed: "250000000000000000",
          arsBorrowSpeed: "750000000000000000",
          borrowCap: "0",
        }
      );
    });
  });

  describe('aTokenMetadataAll', () => {
    it('is correct for a aErc20 and cEther', async () => {
      let aErc20 = await makeAToken();
      let cEth = await makeAToken({kind: 'cether'});
      expect(
        (await call(aquariusLens, 'aTokenMetadataAll', [[aErc20._address, cEth._address]])).map(cullTuple)
      ).toEqual([
        {
          aToken: aErc20._address,
          exchangeRateCurrent: "1000000000000000000",
          supplyRatePerBlock: "0",
          borrowRatePerBlock: "0",
          reserveFactorMantissa: "0",
          totalBorrows: "0",
          totalReserves: "0",
          totalSupply: "0",
          totalCash: "0",
          isListed:false,
          collateralFactorMantissa: "0",
          underlyingAssetAddress: await call(aErc20, 'underlying', []),
          aTokenDecimals: "8",
          underlyingDecimals: "18",
          arsSupplySpeed: "0",
          arsBorrowSpeed: "0",
          borrowCap: "0",
        },
        {
          borrowRatePerBlock: "0",
          aToken: cEth._address,
          aTokenDecimals: "8",
          collateralFactorMantissa: "0",
          exchangeRateCurrent: "1000000000000000000",
          isListed: false,
          reserveFactorMantissa: "0",
          supplyRatePerBlock: "0",
          totalBorrows: "0",
          totalCash: "0",
          totalReserves: "0",
          totalSupply: "0",
          underlyingAssetAddress: "0x0000000000000000000000000000000000000000",
          underlyingDecimals: "18",
          arsSupplySpeed: "0",
          arsBorrowSpeed: "0",
          borrowCap: "0",
        }
      ]);
    });
  });

  describe('aTokenBalances', () => {
    it('is correct for aERC20', async () => {
      let aErc20 = await makeAToken();
      expect(
        cullTuple(await call(aquariusLens, 'aTokenBalances', [aErc20._address, acct]))
      ).toEqual(
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          aToken: aErc20._address,
          tokenAllowance: "0",
          tokenBalance: "10000000000000000000000000",
        }
      );
    });

    it('is correct for cETH', async () => {
      let cEth = await makeAToken({kind: 'cether'});
      let ethBalance = await web3.eth.getBalance(acct);
      expect(
        cullTuple(await call(aquariusLens, 'aTokenBalances', [cEth._address, acct], {gasPrice: '0'}))
      ).toEqual(
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          aToken: cEth._address,
          tokenAllowance: ethBalance,
          tokenBalance: ethBalance,
        }
      );
    });
  });

  describe('aTokenBalancesAll', () => {
    it('is correct for cEth and aErc20', async () => {
      let aErc20 = await makeAToken();
      let cEth = await makeAToken({kind: 'cether'});
      let ethBalance = await web3.eth.getBalance(acct);
      
      expect(
        (await call(aquariusLens, 'aTokenBalancesAll', [[aErc20._address, cEth._address], acct], {gasPrice: '0'})).map(cullTuple)
      ).toEqual([
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          aToken: aErc20._address,
          tokenAllowance: "0",
          tokenBalance: "10000000000000000000000000",
        },
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          aToken: cEth._address,
          tokenAllowance: ethBalance,
          tokenBalance: ethBalance,
        }
      ]);
    })
  });

  describe('aTokenUnderlyingPrice', () => {
    it('gets correct price for aErc20', async () => {
      let aErc20 = await makeAToken();
      expect(
        cullTuple(await call(aquariusLens, 'aTokenUnderlyingPrice', [aErc20._address]))
      ).toEqual(
        {
          aToken: aErc20._address,
          underlyingPrice: "0",
        }
      );
    });

    it('gets correct price for cEth', async () => {
      let cEth = await makeAToken({kind: 'cether'});
      expect(
        cullTuple(await call(aquariusLens, 'aTokenUnderlyingPrice', [cEth._address]))
      ).toEqual(
        {
          aToken: cEth._address,
          underlyingPrice: "0",
        }
      );
    });
  });

  describe('aTokenUnderlyingPriceAll', () => {
    it('gets correct price for both', async () => {
      let aErc20 = await makeAToken();
      let cEth = await makeAToken({kind: 'cether'});
      expect(
        (await call(aquariusLens, 'aTokenUnderlyingPriceAll', [[aErc20._address, cEth._address]])).map(cullTuple)
      ).toEqual([
        {
          aToken: aErc20._address,
          underlyingPrice: "0",
        },
        {
          aToken: cEth._address,
          underlyingPrice: "0",
        }
      ]);
    });
  });

  describe('getAccountLimits', () => {
    it('gets correct values', async () => {
      let comptroller = await makeComptroller();

      expect(
        cullTuple(await call(aquariusLens, 'getAccountLimits', [comptroller._address, acct]))
      ).toEqual({
        liquidity: "0",
        markets: [],
        shortfall: "0"
      });
    });
  });

  describe('governance', () => {
    let ars, gov;
    let targets, values, signatures, callDatas;
    let proposalBlock, proposalId;

    beforeEach(async () => {
      ars = await deploy('Ars', [acct]);
      gov = await deploy('GovernorAlpha', [address(0), ars._address, address(0)]);
      targets = [acct];
      values = ["0"];
      signatures = ["getBalanceOf(address)"];
      callDatas = [encodeParameters(['address'], [acct])];
      await send(ars, 'delegate', [acct]);
      await send(gov, 'propose', [targets, values, signatures, callDatas, "do nothing"]);
      proposalBlock = +(await web3.eth.getBlockNumber());
      proposalId = await call(gov, 'latestProposalIds', [acct]);
    });

    describe('getGovReceipts', () => {
      it('gets correct values', async () => {
        expect(
          (await call(aquariusLens, 'getGovReceipts', [gov._address, acct, [proposalId]])).map(cullTuple)
        ).toEqual([
          {
            hasVoted: false,
            proposalId: proposalId,
            support: false,
            votes: "0",
          }
        ]);
      })
    });

    describe('getGovProposals', () => {
      it('gets correct values', async () => {
        expect(
          (await call(aquariusLens, 'getGovProposals', [gov._address, [proposalId]])).map(cullTuple)
        ).toEqual([
          {
            againstVotes: "0",
            calldatas: callDatas,
            canceled: false,
            endBlock: (Number(proposalBlock) + 129601).toString(),
            eta: "0",
            executed: false,
            forVotes: "0",
            proposalId: proposalId,
            proposer: acct,
            signatures: signatures,
            startBlock: (Number(proposalBlock) + 1).toString(),
            targets: targets
          }
        ]);
      })
    });
  });

  describe('ars', () => {
    let ars, currentBlock;

    beforeEach(async () => {
      currentBlock = +(await web3.eth.getBlockNumber());
      ars = await deploy('Ars', [acct]);
    });

    describe('getArsBalanceMetadata', () => {
      it('gets correct values', async () => {
        expect(
          cullTuple(await call(aquariusLens, 'getArsBalanceMetadata', [ars._address, acct]))
        ).toEqual({
          balance: "1000000000000000000000000000",
          delegate: "0x0000000000000000000000000000000000000000",
          votes: "0",
        });
      });
    });

    describe('getArsBalanceMetadataExt', () => {
      it('gets correct values', async () => {
        let comptroller = await makeComptroller();
        await send(comptroller, 'setArsAccrued', [acct, 5]); // harness only

        expect(
          cullTuple(await call(aquariusLens, 'getArsBalanceMetadataExt', [ars._address, comptroller._address, acct]))
        ).toEqual({
          balance: "1000000000000000000000000000",
          delegate: "0x0000000000000000000000000000000000000000",
          votes: "0",
          allocated: "5"
        });
      });
    });

    describe('getArsVotes', () => {
      it('gets correct values', async () => {
        expect(
          (await call(aquariusLens, 'getArsVotes', [ars._address, acct, [currentBlock, currentBlock - 1]])).map(cullTuple)
        ).toEqual([
          {
            blockNumber: currentBlock.toString(),
            votes: "0",
          },
          {
            blockNumber: (Number(currentBlock) - 1).toString(),
            votes: "0",
          }
        ]);
      });

      it('reverts on future value', async () => {
        await expect(
          call(aquariusLens, 'getArsVotes', [ars._address, acct, [currentBlock + 1]])
        ).rejects.toRevert('revert Ars::getPriorVotes: not yet determined')
      });
    });
  });
});
