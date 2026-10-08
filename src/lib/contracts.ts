import { parseAbi } from 'viem';

type Addr = `0x${string}` | undefined;
export const CHOG_NFT = (process.env.NEXT_PUBLIC_CHOG_NFT || undefined) as Addr;
export const CHOG_TOKEN = (process.env.NEXT_PUBLIC_CHOG_TOKEN || undefined) as Addr;
export const TERRITORY = (process.env.NEXT_PUBLIC_TERRITORY || undefined) as Addr;

export const DEMO = process.env.NEXT_PUBLIC_DEMO === '1' || !CHOG_NFT || !TERRITORY || !CHOG_TOKEN;

export const erc721Abi = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function isApprovedForAll(address owner, address operator) view returns (bool)',
  'function setApprovalForAll(address operator, bool approved)',
  'function tokenURI(uint256 tokenId) view returns (string)',
]);

export const territoryAbi = parseAbi([
  'function claim(uint256 tileId, uint256 chogId)',
  'function attack(uint256 tileId, uint256 chogId)',
  'function claimYield(uint256[] tileIds)',
  'event BattleResolved(uint256 indexed tileId, address indexed attacker, address indexed defender, bool attackerWon, uint256 attackRoll, uint256 defenseRoll)',
]);
