// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Territory is Ownable, ReentrancyGuard, IERC721Receiver {
    using SafeERC20 for IERC20;

    struct Tile {
        address owner;
        uint256 chogId;
        uint64 lastClaim;
    }

    IERC721 public immutable chogNft;
    IERC20 public immutable chogToken;

    uint256 public constant TILE_COUNT = 140;
    uint256 public constant DAY = 1 days;
    uint256 public baseYieldPerDay = 100 ether;
    uint256 public attackFee = 25 ether;
    uint64 public attackCooldown = 1 hours;

    mapping(uint256 => Tile) public tiles;
    mapping(uint256 => uint16) public attackOf;
    mapping(uint256 => uint16) public defenseOf;
    mapping(uint256 => uint16) public yieldBoostBps;
    mapping(uint256 => uint16) public tileYieldBps;
    mapping(uint256 => uint16) public tileDefenseBps;
    mapping(uint256 => uint64) public cooldownUntil;

    event Claimed(uint256 indexed tileId, address indexed owner, uint256 chogId);
    event BattleResolved(
        uint256 indexed tileId, address indexed attacker, address indexed defender,
        bool attackerWon, uint256 attackRoll, uint256 defenseRoll
    );
    event YieldClaimed(uint256 indexed tileId, address indexed to, uint256 amount);
    event Withdrawn(uint256 indexed tileId, address indexed owner, uint256 chogId);

    constructor(address _chogNft, address _chogToken) Ownable(msg.sender) {
        chogNft = IERC721(_chogNft);
        chogToken = IERC20(_chogToken);
    }

    function setTraits(uint256[] calldata ids, uint16[] calldata atk, uint16[] calldata def, uint16[] calldata yb)
        external onlyOwner
    {
        for (uint256 i; i < ids.length; ++i) {
            attackOf[ids[i]] = atk[i];
            defenseOf[ids[i]] = def[i];
            yieldBoostBps[ids[i]] = yb[i];
        }
    }

    function setTileModifiers(uint256[] calldata tileIds, uint16[] calldata yBps, uint16[] calldata dBps) external onlyOwner {
        for (uint256 i; i < tileIds.length; ++i) {
            tileYieldBps[tileIds[i]] = yBps[i];
            tileDefenseBps[tileIds[i]] = dBps[i];
        }
    }

    function fund(uint256 amount) external {
        chogToken.safeTransferFrom(msg.sender, address(this), amount);
    }

    function claim(uint256 tileId, uint256 chogId) external nonReentrant {
        require(tileId < TILE_COUNT, "bad tile");
        require(tiles[tileId].owner == address(0), "taken");
        chogNft.safeTransferFrom(msg.sender, address(this), chogId);
        tiles[tileId] = Tile(msg.sender, chogId, uint64(block.timestamp));
        emit Claimed(tileId, msg.sender, chogId);
    }

    function attack(uint256 tileId, uint256 chogId) external nonReentrant {
        Tile memory t = tiles[tileId];
        require(t.owner != address(0) && t.owner != msg.sender, "not attackable");
        require(cooldownUntil[chogId] <= block.timestamp, "chog resting");

        chogToken.safeTransferFrom(msg.sender, address(this), attackFee);
        chogNft.safeTransferFrom(msg.sender, address(this), chogId);

        uint256 seed = uint256(keccak256(abi.encode(block.prevrandao, msg.sender, tileId, chogId, block.number)));
        uint256 atkRoll = (uint256(attackOf[chogId]) * (7000 + (seed % 6001))) / 10000;
        uint256 defRoll = (_defense(tileId, t.chogId) * (7000 + ((seed >> 128) % 6001))) / 10000;
        bool won = atkRoll > defRoll;

        _settle(tileId, t.owner);

        if (won) {
            chogNft.transferFrom(address(this), t.owner, t.chogId);
            tiles[tileId] = Tile(msg.sender, chogId, uint64(block.timestamp));
        } else {
            chogNft.transferFrom(address(this), msg.sender, chogId);
            cooldownUntil[chogId] = uint64(block.timestamp) + attackCooldown;
        }
        emit BattleResolved(tileId, msg.sender, t.owner, won, atkRoll, defRoll);
    }

    function claimYield(uint256[] calldata tileIds) external nonReentrant {
        for (uint256 i; i < tileIds.length; ++i) {
            require(tiles[tileIds[i]].owner == msg.sender, "not yours");
            _settle(tileIds[i], msg.sender);
        }
    }

    function withdraw(uint256 tileId) external nonReentrant {
        Tile memory t = tiles[tileId];
        require(t.owner == msg.sender, "not yours");
        _settle(tileId, msg.sender);
        delete tiles[tileId];
        chogNft.transferFrom(address(this), msg.sender, t.chogId);
        emit Withdrawn(tileId, msg.sender, t.chogId);
    }

    function pending(uint256 tileId) public view returns (uint256) {
        Tile memory t = tiles[tileId];
        if (t.owner == address(0)) return 0;
        uint256 tb = tileYieldBps[tileId] == 0 ? 10000 : tileYieldBps[tileId];
        uint256 cb = 10000 + yieldBoostBps[t.chogId];
        return (baseYieldPerDay * tb * cb * (block.timestamp - t.lastClaim)) / (1e8 * DAY);
    }

    function _defense(uint256 tileId, uint256 chogId) internal view returns (uint256) {
        uint256 tb = tileDefenseBps[tileId] == 0 ? 10000 : tileDefenseBps[tileId];
        return (uint256(defenseOf[chogId]) * tb) / 10000;
    }

    function _settle(uint256 tileId, address to) internal {
        uint256 amt = pending(tileId);
        tiles[tileId].lastClaim = uint64(block.timestamp);
        uint256 bal = chogToken.balanceOf(address(this));
        if (amt > bal) amt = bal;
        if (amt > 0) {
            chogToken.safeTransfer(to, amt);
            emit YieldClaimed(tileId, to, amt);
        }
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
