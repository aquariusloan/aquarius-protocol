const {
  both,
  etherMantissa,
  encodeParameters,
  advanceBlocks,
  freezeTime,
  mineBlock
} = require('../../Utils/Ethereum');

async function enfranchise(ars, actor, amount) {
  await send(ars, 'transfer', [actor, etherMantissa(amount)]);
  await send(ars, 'delegate', [actor], {from: actor});
}

describe('GovernorBravo#queue/1', () => {
  let root, a1, a2, accounts;
  beforeAll(async () => {
    [root, a1, a2, ...accounts] = saddle.accounts;
  });

  describe("overlapping actions", () => {
    it("reverts on queueing overlapping actions in same proposal", async () => {
      const timelock = await deploy('TimelockHarness', [root, 86400 * 2]);
      const ars = await deploy('Ars', [root]);
      const gov = await deploy('GovernorBravoImmutable', [timelock._address, ars._address, root, 129600, 1, "100000000000000000000000"]);
      await send(gov, '_initiate');
      const txAdmin = await send(timelock, 'harnessSetAdmin', [gov._address]);

      await enfranchise(ars, a1, 3e8);
      await mineBlock();

      const targets = [ars._address, ars._address];
      const values = ["0", "0"];
      const signatures = ["getBalanceOf(address)", "getBalanceOf(address)"];
      const calldatas = [encodeParameters(['address'], [root]), encodeParameters(['address'], [root])];
      const {reply: proposalId1} = await both(gov, 'propose', [targets, values, signatures, calldatas, "do nothing"], {from: a1});
      await mineBlock();

      const txVote1 = await send(gov, 'castVote', [proposalId1, 1], {from: a1});
      await advanceBlocks(150000);

      await expect(
        send(gov, 'queue', [proposalId1])
      ).rejects.toRevert("revert GovernorBravo::queueOrRevertInternal: identical proposal action already queued at eta");
    });

    it("reverts on queueing overlapping actions in different proposals, works if waiting", async () => {
      const timelock = await deploy('TimelockHarness', [root, 86400 * 2]);
      const ars = await deploy('Ars', [root]);
      const gov = await deploy('GovernorBravoImmutable', [timelock._address, ars._address, root, 129600, 1, "100000000000000000000000"]);
      await send(gov, '_initiate');
      const txAdmin = await send(timelock, 'harnessSetAdmin', [gov._address]);

      await enfranchise(ars, a1, 3e8);
      await enfranchise(ars, a2, 3e8);
      await mineBlock();

      const targets = [ars._address];
      const values = ["0"];
      const signatures = ["getBalanceOf(address)"];
      const calldatas = [encodeParameters(['address'], [root])];
      const {reply: proposalId1} = await both(gov, 'propose', [targets, values, signatures, calldatas, "do nothing"], {from: a1});
      const {reply: proposalId2} = await both(gov, 'propose', [targets, values, signatures, calldatas, "do nothing"], {from: a2});
      await mineBlock();

      const txVote1 = await send(gov, 'castVote', [proposalId1, 1], {from: a1});
      const txVote2 = await send(gov, 'castVote', [proposalId2, 1], {from: a2});
      await advanceBlocks(150000);
      await freezeTime(100);

      const txQueue1 = await send(gov, 'queue', [proposalId1]);
      await expect(
        send(gov, 'queue', [proposalId2])
      ).rejects.toRevert("revert GovernorBravo::queueOrRevertInternal: identical proposal action already queued at eta");

      await freezeTime(101);
      const txQueue2 = await send(gov, 'queue', [proposalId2]);
    });
  });
});
