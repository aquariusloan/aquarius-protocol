import { Event } from '../Event';
import { World } from '../World';
import { AErc20Delegate, AErc20DelegateScenario } from '../Contract/AErc20Delegate';
import { AToken } from '../Contract/AToken';
import { Invokation } from '../Invokation';
import { getStringV } from '../CoreValue';
import { AddressV, NumberV, StringV } from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { storeAndSaveContract } from '../Networks';
import { getContract, getTestContract } from '../Contract';

const ADaiDelegateContract = getContract('ADaiDelegate');
const ADaiDelegateScenarioContract = getTestContract('ADaiDelegateScenario');
const AErc20DelegateContract = getContract('AErc20Delegate');
const AErc20DelegateScenarioContract = getTestContract('AErc20DelegateScenario');


export interface ATokenDelegateData {
  invokation: Invokation<AErc20Delegate>;
  name: string;
  contract: string;
  description?: string;
}

export async function buildATokenDelegate(
  world: World,
  from: string,
  params: Event
): Promise<{ world: World; aTokenDelegate: AErc20Delegate; delegateData: ATokenDelegateData }> {
  const fetchers = [
    new Fetcher<{ name: StringV; }, ATokenDelegateData>(
      `
        #### ADaiDelegate

        * "ADaiDelegate name:<String>"
          * E.g. "ATokenDelegate Deploy ADaiDelegate aDAIDelegate"
      `,
      'ADaiDelegate',
      [
        new Arg('name', getStringV)
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await ADaiDelegateContract.deploy<AErc20Delegate>(world, from, []),
          name: name.val,
          contract: 'ADaiDelegate',
          description: 'Standard CDai Delegate'
        };
      }
    ),

    new Fetcher<{ name: StringV; }, ATokenDelegateData>(
      `
        #### ADaiDelegateScenario

        * "ADaiDelegateScenario name:<String>" - A ADaiDelegate Scenario for local testing
          * E.g. "ATokenDelegate Deploy ADaiDelegateScenario aDAIDelegate"
      `,
      'ADaiDelegateScenario',
      [
        new Arg('name', getStringV)
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await ADaiDelegateScenarioContract.deploy<AErc20DelegateScenario>(world, from, []),
          name: name.val,
          contract: 'ADaiDelegateScenario',
          description: 'Scenario CDai Delegate'
        };
      }
    ),

    new Fetcher<{ name: StringV; }, ATokenDelegateData>(
      `
        #### AErc20Delegate

        * "AErc20Delegate name:<String>"
          * E.g. "ATokenDelegate Deploy AErc20Delegate aDAIDelegate"
      `,
      'AErc20Delegate',
      [
        new Arg('name', getStringV)
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await AErc20DelegateContract.deploy<AErc20Delegate>(world, from, []),
          name: name.val,
          contract: 'AErc20Delegate',
          description: 'Standard AErc20 Delegate'
        };
      }
    ),

    new Fetcher<{ name: StringV; }, ATokenDelegateData>(
      `
        #### AErc20DelegateScenario

        * "AErc20DelegateScenario name:<String>" - A AErc20Delegate Scenario for local testing
          * E.g. "ATokenDelegate Deploy AErc20DelegateScenario aDAIDelegate"
      `,
      'AErc20DelegateScenario',
      [
        new Arg('name', getStringV),
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await AErc20DelegateScenarioContract.deploy<AErc20DelegateScenario>(world, from, []),
          name: name.val,
          contract: 'AErc20DelegateScenario',
          description: 'Scenario AErc20 Delegate'
        };
      }
    )
  ];

  let delegateData = await getFetcherValue<any, ATokenDelegateData>("DeployAToken", fetchers, world, params);
  let invokation = delegateData.invokation;
  delete delegateData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }

  const aTokenDelegate = invokation.value!;

  world = await storeAndSaveContract(
    world,
    aTokenDelegate,
    delegateData.name,
    invokation,
    [
      {
        index: ['ATokenDelegate', delegateData.name],
        data: {
          address: aTokenDelegate._address,
          contract: delegateData.contract,
          description: delegateData.description
        }
      }
    ]
  );

  return { world, aTokenDelegate, delegateData };
}
