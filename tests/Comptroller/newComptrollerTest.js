const {
  address,
  etherMantissa
} = require('../Utils/Ethereum');

const {
} = require('../Utils/Aquarius');

describe('Comptroller', () => {
  let root, accounts;
  let comptroller;

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
    comptroller = await deploy('Comptroller');
  });

  let setPending = (newAdmin, from) => {
    return send(comptroller, '_setPendingAdminInComptroller', [newAdmin], {from});
  };

  describe("constructor", () => {
    it("sets admin to caller and addresses to 0", async () => {
      expect(await call(comptroller, 'admin')).toEqual(root);
      expect(await call(comptroller, 'pendingAdmin')).toBeAddressZero();
      expect(await call(comptroller, 'pendingComptrollerImplementation')).toBeAddressZero();
      expect(await call(comptroller, 'comptrollerImplementation')).toBeAddressZero();
    });
  });

  describe("_setPendingAdminInComptroller", () => {
    describe("Check caller is admin", () => {
      let result;
      beforeEach(async () => {
        result = await setPending(accounts[1], accounts[1]);
      });

      it("emits a failure log", async () => {
        expect(result).toHaveTrollFailure('UNAUTHORIZED', 'SET_PENDING_ADMIN_OWNER_CHECK');
      });

      it("does not change pending admin address", async () => {
        expect(await call(comptroller, 'pendingAdmin')).toBeAddressZero()
      });
    });

    describe("succeeding", () => {
      it("stores pendingAdmin with value newAdmin", async () => {
        await setPending(accounts[1], root);
        expect(await call(comptroller, 'pendingAdmin')).toEqual(accounts[1]);
      });
    });
  });

  describe("_acceptAdminInComptroller", () => {
    describe("Check caller is pendingAdmin and pendingAdmin ≠ address(0) ", () => {
      let result;
      beforeEach(async () => {
        await setPending(accounts[1], accounts[1]);
        result = await send(comptroller, '_acceptAdminInComptroller');
      });

      it("emits a failure log", async () => {
        expect(result).toHaveTrollFailure('UNAUTHORIZED', 'ACCEPT_ADMIN_PENDING_ADMIN_CHECK');
      });

      it("does not change current admin address", async () => {
        expect(await call(comptroller, 'admin')).not.toEqual(account[1]);
      });
    });

    describe("the comptroller must accept the responsibility of admin", () => {
      let result;
      beforeEach(async () => {
        await setPending(accounts[1], root);
        result = await send(comptroller, '_acceptAdminInComptroller', {from:accounts[1]});
        expect(result).toSucceed();
      });

      it("Store admin with value pendingAdmin", async () => {
        expect(await call(comptroller, 'admin')).toEqual(accounts[1]);
      });

      it("Unset pendingAdmin", async () => {
        expect(await call(comptroller, 'pendingAdmin')).toBeAddressZero();
      });
    });
  });
});
