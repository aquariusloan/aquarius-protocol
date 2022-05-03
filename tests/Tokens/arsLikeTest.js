const {
  makeAToken,
} = require('../Utils/Aquarius');


describe('CArsLikeDelegate', function () {
  describe("_delegateArsLikeTo", () => {
    it("does not delegate if not the admin", async () => {
      const [root, a1] = saddle.accounts;
      const aToken = await makeAToken({kind: 'aars'});
      await expect(send(aToken, '_delegateArsLikeTo', [a1], {from: a1})).rejects.toRevert('revert only the admin may set the ars-like delegate');
    });

    it("delegates successfully if the admin", async () => {
      const [root, a1] = saddle.accounts, amount = 1;
      const aARS = await makeAToken({kind: 'aars'}), ARS = aARS.underlying;
      const tx1 = await send(aARS, '_delegateArsLikeTo', [a1]);
      const tx2 = await send(ARS, 'transfer', [aARS._address, amount]);
      await expect(await call(ARS, 'getCurrentVotes', [a1])).toEqualNumber(amount);
    });
  });
});