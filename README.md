# Territory

*A living on-chain map on Monad. CHOG. WORLD. ORDER.*

**Territory** is a competitive territorial control game built for the Web3 gaming ecosystem. Deployed on the Monad network, it leverages the Chog Genesis NFT collection and the `$CHOG` token to create a high-stakes, yield-generating strategy experience.

## Gameplay Mechanics

The game takes place on a dynamic hex-grid map representing different biomes. Players connect their wallets and deploy their Chog NFTs onto the map to establish dominance.

### Claiming Land & Yield
Players can stake an unassigned Chog NFT on any vacant hex. Once claimed, the territory immediately begins generating `$CHOG` tokens passively. The daily yield is determined by combining the base multiplier of the specific biome with the intrinsic rarity tier of the staked Chog NFT. 

### Combat and Expansion
To expand their empire, players must attack adjacent territories controlled by rival lords. Initiating an attack requires paying a `$CHOG` fee. Combat outcomes are calculated by comparing the attacker's ATK power against the defender's DEF power, modified by simulated dice rolls and occasional critical chaos surges. Winning a battle allows the attacker to seize the land, effectively un-staking the loser's NFT and stopping their yield generation.

### Live Leaderboard
A real-time global leaderboard tracks the top warlords on the map, ranking them by total land controlled and daily yield generated.

## Chog Ecosystem Integration

The architecture is designed to natively support and expand the utility of the Chog ecosystem.

* **NFT Utility:** Chog Genesis NFTs act as the primary game pieces. The application fetches live metadata directly from IPFS to determine the exact visual appearance, Tier, ATK, and DEF stats of every character deployed on the map. 
* **Token Economy:** The `$CHOG` token functions as the primary reward mechanism for holding territory and acts as the currency required to fund military campaigns against other players, creating a balanced sink and faucet economic loop.

## Technical Architecture

* **Frontend:** Next.js 14, React, Tailwind CSS.
* **Rendering Engine:** Custom PixiJS WebGL engine, allowing highly performant rendering of interactive hex tiles at 60 FPS. Smart viewport camera logic ensures the map automatically adjusts to accommodate UI panels dynamically.
* **State & Web3:** Zustand for state management, Wagmi for reading on-chain NFT states.
* **Security & Production:** Production builds feature automated UI security measures to deter client-side tampering (DevTools/F12 blocking) ensuring a seamless demonstration environment.

## Demo Mode

To ensure a frictionless onboarding experience for new users, the current build features a comprehensive **Demo Mode**. This allows users to experience the full gameplay loop—claiming, harvesting, and attacking—entirely client-side without needing to sign transactions, own specific NFTs, or spend real Monad gas fees.

*Note: Territory is currently a desktop-first experience. Mobile devices will be greeted with a specialized landing screen while the touch-optimized mobile interface is under development.*

## Running Locally

Clone the repository and install dependencies:

```bash
npm install
```

Configure your environment variables by copying the example file (all variables are optional for Demo Mode):
```bash
cp .env.example .env.local
```

To test the application with maximum WebGL performance, we strongly recommend running the production build rather than the development server:

```bash
npm run build
npm start
```
The application will be accessible at `http://localhost:3000`.
