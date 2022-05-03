import { Event } from '../Event';
import { World } from '../World';
import { Ars } from '../Contract/Ars';
import {
  getAddressV,
  getNumberV
} from '../CoreValue';
import {
  AddressV,
  ListV,
  NumberV,
  StringV,
  Value
} from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { getArs } from '../ContractLookup';

export function arsFetchers() {
  return [
    new Fetcher<{ ars: Ars }, AddressV>(`
        #### Address

        * "<Ars> Address" - Returns the address of Ars token
          * E.g. "Ars Address"
      `,
      "Address",
      [
        new Arg("ars", getArs, { implicit: true })
      ],
      async (world, { ars }) => new AddressV(ars._address)
    ),

    new Fetcher<{ ars: Ars }, StringV>(`
        #### Name

        * "<Ars> Name" - Returns the name of the Ars token
          * E.g. "Ars Name"
      `,
      "Name",
      [
        new Arg("ars", getArs, { implicit: true })
      ],
      async (world, { ars }) => new StringV(await ars.methods.name().call())
    ),

    new Fetcher<{ ars: Ars }, StringV>(`
        #### Symbol

        * "<Ars> Symbol" - Returns the symbol of the Ars token
          * E.g. "Ars Symbol"
      `,
      "Symbol",
      [
        new Arg("ars", getArs, { implicit: true })
      ],
      async (world, { ars }) => new StringV(await ars.methods.symbol().call())
    ),

    new Fetcher<{ ars: Ars }, NumberV>(`
        #### Decimals

        * "<Ars> Decimals" - Returns the number of decimals of the Ars token
          * E.g. "Ars Decimals"
      `,
      "Decimals",
      [
        new Arg("ars", getArs, { implicit: true })
      ],
      async (world, { ars }) => new NumberV(await ars.methods.decimals().call())
    ),

    new Fetcher<{ ars: Ars }, NumberV>(`
        #### TotalSupply

        * "Ars TotalSupply" - Returns Ars token's total supply
      `,
      "TotalSupply",
      [
        new Arg("ars", getArs, { implicit: true })
      ],
      async (world, { ars }) => new NumberV(await ars.methods.totalSupply().call())
    ),

    new Fetcher<{ ars: Ars, address: AddressV }, NumberV>(`
        #### TokenBalance

        * "Ars TokenBalance <Address>" - Returns the Ars token balance of a given address
          * E.g. "Ars TokenBalance Geoff" - Returns Geoff's Ars balance
      `,
      "TokenBalance",
      [
        new Arg("ars", getArs, { implicit: true }),
        new Arg("address", getAddressV)
      ],
      async (world, { ars, address }) => new NumberV(await ars.methods.balanceOf(address.val).call())
    ),

    new Fetcher<{ ars: Ars, owner: AddressV, spender: AddressV }, NumberV>(`
        #### Allowance

        * "Ars Allowance owner:<Address> spender:<Address>" - Returns the Ars allowance from owner to spender
          * E.g. "Ars Allowance Geoff Torrey" - Returns the Ars allowance of Geoff to Torrey
      `,
      "Allowance",
      [
        new Arg("ars", getArs, { implicit: true }),
        new Arg("owner", getAddressV),
        new Arg("spender", getAddressV)
      ],
      async (world, { ars, owner, spender }) => new NumberV(await ars.methods.allowance(owner.val, spender.val).call())
    ),

    new Fetcher<{ ars: Ars, account: AddressV }, NumberV>(`
        #### GetCurrentVotes

        * "Ars GetCurrentVotes account:<Address>" - Returns the current Ars votes balance for an account
          * E.g. "Ars GetCurrentVotes Geoff" - Returns the current Ars vote balance of Geoff
      `,
      "GetCurrentVotes",
      [
        new Arg("ars", getArs, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      async (world, { ars, account }) => new NumberV(await ars.methods.getCurrentVotes(account.val).call())
    ),

    new Fetcher<{ ars: Ars, account: AddressV, blockNumber: NumberV }, NumberV>(`
        #### GetPriorVotes

        * "Ars GetPriorVotes account:<Address> blockBumber:<Number>" - Returns the current Ars votes balance at given block
          * E.g. "Ars GetPriorVotes Geoff 5" - Returns the Ars vote balance for Geoff at block 5
      `,
      "GetPriorVotes",
      [
        new Arg("ars", getArs, { implicit: true }),
        new Arg("account", getAddressV),
        new Arg("blockNumber", getNumberV),
      ],
      async (world, { ars, account, blockNumber }) => new NumberV(await ars.methods.getPriorVotes(account.val, blockNumber.encode()).call())
    ),

    new Fetcher<{ ars: Ars, account: AddressV }, NumberV>(`
        #### GetCurrentVotesBlock

        * "Ars GetCurrentVotesBlock account:<Address>" - Returns the current Ars votes checkpoint block for an account
          * E.g. "Ars GetCurrentVotesBlock Geoff" - Returns the current Ars votes checkpoint block for Geoff
      `,
      "GetCurrentVotesBlock",
      [
        new Arg("ars", getArs, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      async (world, { ars, account }) => {
        const numCheckpoints = Number(await ars.methods.numCheckpoints(account.val).call());
        const checkpoint = await ars.methods.checkpoints(account.val, numCheckpoints - 1).call();

        return new NumberV(checkpoint.fromBlock);
      }
    ),

    new Fetcher<{ ars: Ars, account: AddressV }, NumberV>(`
        #### VotesLength

        * "Ars VotesLength account:<Address>" - Returns the Ars vote checkpoint array length
          * E.g. "Ars VotesLength Geoff" - Returns the Ars vote checkpoint array length of Geoff
      `,
      "VotesLength",
      [
        new Arg("ars", getArs, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      async (world, { ars, account }) => new NumberV(await ars.methods.numCheckpoints(account.val).call())
    ),

    new Fetcher<{ ars: Ars, account: AddressV }, ListV>(`
        #### AllVotes

        * "Ars AllVotes account:<Address>" - Returns information about all votes an account has had
          * E.g. "Ars AllVotes Geoff" - Returns the Ars vote checkpoint array
      `,
      "AllVotes",
      [
        new Arg("ars", getArs, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      async (world, { ars, account }) => {
        const numCheckpoints = Number(await ars.methods.numCheckpoints(account.val).call());
        const checkpoints = await Promise.all(new Array(numCheckpoints).fill(undefined).map(async (_, i) => {
          const {fromBlock, votes} = await ars.methods.checkpoints(account.val, i).call();

          return new StringV(`Block ${fromBlock}: ${votes} vote${votes !== 1 ? "s" : ""}`);
        }));

        return new ListV(checkpoints);
      }
    )
  ];
}

export async function getArsValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("Ars", arsFetchers(), world, event);
}
