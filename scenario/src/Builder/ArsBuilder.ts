import { Event } from '../Event';
import { World, addAction } from '../World';
import { Ars, ArsScenario } from '../Contract/Ars';
import { Invokation } from '../Invokation';
import { getAddressV } from '../CoreValue';
import { StringV, AddressV } from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { storeAndSaveContract } from '../Networks';
import { getContract } from '../Contract';

const ArsContract = getContract('Ars');
const ArsScenarioContract = getContract('ArsScenario');

export interface TokenData {
  invokation: Invokation<Ars>;
  contract: string;
  address?: string;
  symbol: string;
  name: string;
  decimals?: number;
}

export async function buildArs(
  world: World,
  from: string,
  params: Event
): Promise<{ world: World; ars: Ars; tokenData: TokenData }> {
  const fetchers = [
    new Fetcher<{ account: AddressV }, TokenData>(
      `
      #### Scenario

      * "Ars Deploy Scenario account:<Address>" - Deploys Scenario Ars Token
        * E.g. "Ars Deploy Scenario Geoff"
    `,
      'Scenario',
      [
        new Arg("account", getAddressV),
      ],
      async (world, { account }) => {
        return {
          invokation: await ArsScenarioContract.deploy<ArsScenario>(world, from, [account.val]),
          contract: 'ArsScenario',
          symbol: 'ARS',
          name: 'Aquarius Governance Token',
          decimals: 18
        };
      }
    ),

    new Fetcher<{ account: AddressV }, TokenData>(
      `
      #### Ars

      * "Ars Deploy account:<Address>" - Deploys Ars Token
        * E.g. "Ars Deploy Geoff"
    `,
      'Ars',
      [
        new Arg("account", getAddressV),
      ],
      async (world, { account }) => {
        if (world.isLocalNetwork()) {
          return {
            invokation: await ArsScenarioContract.deploy<ArsScenario>(world, from, [account.val]),
            contract: 'ArsScenario',
            symbol: 'ARS',
            name: 'Aquarius Governance Token',
            decimals: 18
          };
        } else {
          return {
            invokation: await ArsContract.deploy<Ars>(world, from, [account.val]),
            contract: 'Ars',
            symbol: 'ARS',
            name: 'Aquarius Governance Token',
            decimals: 18
          };
        }
      },
      { catchall: true }
    )
  ];

  let tokenData = await getFetcherValue<any, TokenData>("DeployArs", fetchers, world, params);
  let invokation = tokenData.invokation;
  delete tokenData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }

  const ars = invokation.value!;
  tokenData.address = ars._address;

  world = await storeAndSaveContract(
    world,
    ars,
    'Ars',
    invokation,
    [
      { index: ['Ars'], data: tokenData },
      { index: ['Tokens', tokenData.symbol], data: tokenData }
    ]
  );

  tokenData.invokation = invokation;

  return { world, ars, tokenData };
}
