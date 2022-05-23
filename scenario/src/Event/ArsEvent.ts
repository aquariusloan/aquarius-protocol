import { Event } from '../Event';
import { addAction, World, describeUser } from '../World';
import { Ars, ArsScenario } from '../Contract/Ars';
import { buildArs } from '../Builder/ArsBuilder';
import { invoke } from '../Invokation';
import {
  getAddressV,
  getEventV,
  getNumberV,
  getStringV,
} from '../CoreValue';
import {
  AddressV,
  EventV,
  NumberV,
  StringV
} from '../Value';
import { Arg, Command, processCommandEvent, View } from '../Command';
import { getArs } from '../ContractLookup';
import { NoErrorReporter } from '../ErrorReporter';
import { verify } from '../Verify';
import { encodedNumber } from '../Encoding';

async function genArs(world: World, from: string, params: Event): Promise<World> {
  let { world: nextWorld, ars, tokenData } = await buildArs(world, from, params);
  world = nextWorld;

  world = addAction(
    world,
    `Deployed Ars (${ars.name}) to address ${ars._address}`,
    tokenData.invokation
  );

  return world;
}

async function verifyArs(world: World, ars: Ars, apiKey: string, modelName: string, contractName: string): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, modelName, contractName, ars._address);
  }

  return world;
}

async function approve(world: World, from: string, ars: Ars, address: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, ars.methods.approve(address, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Approved Ars token for ${from} of ${amount.show()}`,
    invokation
  );

  return world;
}

async function transfer(world: World, from: string, ars: Ars, address: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, ars.methods.transfer(address, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} Ars tokens from ${from} to ${address}`,
    invokation
  );

  return world;
}

async function transferFrom(world: World, from: string, ars: Ars, owner: string, spender: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, ars.methods.transferFrom(owner, spender, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `"Transferred from" ${amount.show()} Ars tokens from ${owner} to ${spender}`,
    invokation
  );

  return world;
}

async function transferScenario(world: World, from: string, ars: ArsScenario, addresses: string[], amount: NumberV): Promise<World> {
  let invokation = await invoke(world, ars.methods.transferScenario(addresses, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} Ars tokens from ${from} to ${addresses}`,
    invokation
  );

  return world;
}

async function transferFromScenario(world: World, from: string, ars: ArsScenario, addresses: string[], amount: NumberV): Promise<World> {
  let invokation = await invoke(world, ars.methods.transferFromScenario(addresses, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} Ars tokens from ${addresses} to ${from}`,
    invokation
  );

  return world;
}

async function delegate(world: World, from: string, ars: Ars, account: string): Promise<World> {
  let invokation = await invoke(world, ars.methods.delegate(account), from, NoErrorReporter);

  world = addAction(
    world,
    `"Delegated from" ${from} to ${account}`,
    invokation
  );

  return world;
}

async function setBlockNumber(
  world: World,
  from: string,
  ars: Ars,
  blockNumber: NumberV
): Promise<World> {
  return addAction(
    world,
    `Set Ars blockNumber to ${blockNumber.show()}`,
    await invoke(world, ars.methods.setBlockNumber(blockNumber.encode()), from)
  );
}

export function arsCommands() {
  return [
    new Command<{ params: EventV }>(`
        #### Deploy

        * "Deploy ...params" - Generates a new Ars token
          * E.g. "Ars Deploy"
      `,
      "Deploy",
      [
        new Arg("params", getEventV, { variadic: true })
      ],
      (world, from, { params }) => genArs(world, from, params.val)
    ),

    new View<{ ars: Ars, apiKey: StringV, contractName: StringV }>(`
        #### Verify

        * "<Ars> Verify apiKey:<String> contractName:<String>=Ars" - Verifies Ars token in Etherscan
          * E.g. "Ars Verify "myApiKey"
      `,
      "Verify",
      [
        new Arg("ars", getArs, { implicit: true }),
        new Arg("apiKey", getStringV),
        new Arg("contractName", getStringV, { default: new StringV("Ars") })
      ],
      async (world, { ars, apiKey, contractName }) => {
        return await verifyArs(world, ars, apiKey.val, ars.name, contractName.val)
      }
    ),

    new Command<{ ars: Ars, spender: AddressV, amount: NumberV }>(`
        #### Approve

        * "Ars Approve spender:<Address> <Amount>" - Adds an allowance between user and address
          * E.g. "Ars Approve Geoff 1.0e18"
      `,
      "Approve",
      [
        new Arg("ars", getArs, { implicit: true }),
        new Arg("spender", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { ars, spender, amount }) => {
        return approve(world, from, ars, spender.val, amount)
      }
    ),

    new Command<{ ars: Ars, recipient: AddressV, amount: NumberV }>(`
        #### Transfer

        * "Ars Transfer recipient:<User> <Amount>" - Transfers a number of tokens via "transfer" as given user to recipient (this does not depend on allowance)
          * E.g. "Ars Transfer Torrey 1.0e18"
      `,
      "Transfer",
      [
        new Arg("ars", getArs, { implicit: true }),
        new Arg("recipient", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { ars, recipient, amount }) => transfer(world, from, ars, recipient.val, amount)
    ),

    new Command<{ ars: Ars, owner: AddressV, spender: AddressV, amount: NumberV }>(`
        #### TransferFrom

        * "Ars TransferFrom owner:<User> spender:<User> <Amount>" - Transfers a number of tokens via "transfeFrom" to recipient (this depends on allowances)
          * E.g. "Ars TransferFrom Geoff Torrey 1.0e18"
      `,
      "TransferFrom",
      [
        new Arg("ars", getArs, { implicit: true }),
        new Arg("owner", getAddressV),
        new Arg("spender", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { ars, owner, spender, amount }) => transferFrom(world, from, ars, owner.val, spender.val, amount)
    ),

    new Command<{ ars: ArsScenario, recipients: AddressV[], amount: NumberV }>(`
        #### TransferScenario

        * "Ars TransferScenario recipients:<User[]> <Amount>" - Transfers a number of tokens via "transfer" to the given recipients (this does not depend on allowance)
          * E.g. "Ars TransferScenario (Jared Torrey) 10"
      `,
      "TransferScenario",
      [
        new Arg("ars", getArs, { implicit: true }),
        new Arg("recipients", getAddressV, { mapped: true }),
        new Arg("amount", getNumberV)
      ],
      (world, from, { ars, recipients, amount }) => transferScenario(world, from, ars, recipients.map(recipient => recipient.val), amount)
    ),

    new Command<{ ars: ArsScenario, froms: AddressV[], amount: NumberV }>(`
        #### TransferFromScenario

        * "Ars TransferFromScenario froms:<User[]> <Amount>" - Transfers a number of tokens via "transferFrom" from the given users to msg.sender (this depends on allowance)
          * E.g. "Ars TransferFromScenario (Jared Torrey) 10"
      `,
      "TransferFromScenario",
      [
        new Arg("ars", getArs, { implicit: true }),
        new Arg("froms", getAddressV, { mapped: true }),
        new Arg("amount", getNumberV)
      ],
      (world, from, { ars, froms, amount }) => transferFromScenario(world, from, ars, froms.map(_from => _from.val), amount)
    ),

    new Command<{ ars: Ars, account: AddressV }>(`
        #### Delegate

        * "Ars Delegate account:<Address>" - Delegates votes to a given account
          * E.g. "Ars Delegate Torrey"
      `,
      "Delegate",
      [
        new Arg("ars", getArs, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      (world, from, { ars, account }) => delegate(world, from, ars, account.val)
    ),
    new Command<{ ars: Ars, blockNumber: NumberV }>(`
      #### SetBlockNumber

      * "SetBlockNumber <Seconds>" - Sets the blockTimestamp of the Ars Harness
      * E.g. "Ars SetBlockNumber 500"
      `,
        'SetBlockNumber',
        [new Arg('ars', getArs, { implicit: true }), new Arg('blockNumber', getNumberV)],
        (world, from, { ars, blockNumber }) => setBlockNumber(world, from, ars, blockNumber)
      )
  ];
}

export async function processArsEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("Ars", arsCommands(), world, event, from);
}
