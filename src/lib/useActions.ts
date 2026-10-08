'use client';

import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { erc20Abi, parseEventLogs, parseUnits } from 'viem';
import { useGame } from '@/store/useGame';
import { ATTACK_FEE, deriveChog, simulate, tileDefense } from './game';
import { CHOG_NFT, CHOG_TOKEN, DEMO, TERRITORY, erc721Abi, territoryAbi } from './contracts';
import { burst, sfx } from './fx';
import type { BattleResult, Chog } from './types';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useActions() {
  const { address } = useAccount();
  const pc = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const store = useGame;

  const wait = (hash: `0x${string}`) => pc!.waitForTransactionReceipt({ hash });

  async function ensureNftApproval() {
    const ok = await pc!.readContract({ address: CHOG_NFT!, abi: erc721Abi, functionName: 'isApprovedForAll', args: [address!, TERRITORY!] });
    if (!ok) await wait(await writeContractAsync({ address: CHOG_NFT!, abi: erc721Abi, functionName: 'setApprovalForAll', args: [TERRITORY!, true] }));
  }

  async function ensureFeeAllowance() {
    const fee = parseUnits(String(ATTACK_FEE), 18);
    const a = await pc!.readContract({ address: CHOG_TOKEN!, abi: erc20Abi, functionName: 'allowance', args: [address!, TERRITORY!] });
    if (a < fee) await wait(await writeContractAsync({ address: CHOG_TOKEN!, abi: erc20Abi, functionName: 'approve', args: [TERRITORY!, fee * 100n] }));
  }

  async function claim(tileId: number, chogId: number) {
    if (DEMO || store.getState().isGuest) await sleep(900);
    else {
      await ensureNftApproval();
      await wait(await writeContractAsync({ address: TERRITORY!, abi: territoryAbi, functionName: 'claim', args: [BigInt(tileId), BigInt(chogId)] }));
    }
    store.getState().claimTile(tileId, chogId);
    burst('claim');
    sfx.claim();
  }

  async function attack(tileId: number, chog: Chog) {
    const tile = store.getState().territories[tileId];
    const defChog = deriveChog(tile.chogId!);
    let result: BattleResult;
    if (DEMO || store.getState().isGuest) {
      await sleep(700);
      result = simulate(chog, tile);
    } else {
      await ensureNftApproval();
      await ensureFeeAllowance();
      const rc = await wait(await writeContractAsync({ address: TERRITORY!, abi: territoryAbi, functionName: 'attack', args: [BigInt(tileId), BigInt(chog.id)] }));
      const [ev] = parseEventLogs({ abi: territoryAbi, logs: rc.logs, eventName: 'BattleResolved' });
      if (!ev) throw new Error('Battle event not found');
      result = {
        atkPower: chog.attack, defPower: tileDefense(tile),
        atkRoll: Number(ev.args.attackRoll), defRoll: Number(ev.args.defenseRoll),
        won: ev.args.attackerWon, chaos: null,
      };
    }
    store.getState().startBattle({ tileId, chog, defChog, result, committed: false });
  }

  async function harvest(ids: number[]) {
    if (DEMO || store.getState().isGuest) await sleep(450);
    else await wait(await writeContractAsync({ address: TERRITORY!, abi: territoryAbi, functionName: 'claimYield', args: [ids.map(BigInt)] }));
    const amount = store.getState().harvest(ids, Date.now());
    burst('yield');
    sfx.yield();
    return amount;
  }

  return { claim, attack, harvest };
}
