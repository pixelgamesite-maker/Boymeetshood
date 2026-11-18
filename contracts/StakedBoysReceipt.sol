// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title StakedBoysReceipt (sBOYS)
 * @notice A soulbound ERC-721 that mirrors staked Boys 1:1 for Discord
 *         token-gating (Vulcan, Collab.Land, etc.).
 *
 * Staking moves a Boy out of the holder's wallet into JuiceStaking, so a gating
 * bot that indexes on-chain holders sees the staker holding nothing and revokes
 * their role. Unlike a read-only `balanceOf` shim, this contract emits REAL
 * mint/transfer events: when a Boy is staked, a matching sBOYS token (same id)
 * is minted to the staker; when it's unstaked, the sBOYS is burned. Indexers
 * therefore see the staker as a genuine holder of this collection.
 *
 * The staking contract is the single source of truth. `sync` only ever mints a
 * token to the wallet that actually staked it, and only ever burns one that is
 * no longer staked — so it cannot be gamed and anyone may call it. Tokens are
 * soulbound (non-transferable) so a receipt can't be handed to a non-staker.
 *
 * It is non-custodial: it holds nothing and can move no real asset.
 */
interface IBoys {
    function tokenURI(uint256 tokenId) external view returns (string memory);
}

struct StakeInfo {
    address owner;
    uint40 stakedAt;
    uint40 unlockTime;
    uint40 lastClaimAt;
    uint32 durationDays;
    uint256 rewardRate;
    uint256 claimedReward;
    bool isStaked;
}

interface IJuiceStakingView {
    function getStake(uint256 tokenId) external view returns (StakeInfo memory);
    function getUserStakes(address user) external view returns (uint256[] memory);
}

contract StakedBoysReceipt is ERC721 {
    /// @notice The Boys ERC-721 collection (for metadata passthrough).
    IBoys public immutable boys;
    /// @notice The JuiceStaking contract — the source of truth for stakes.
    IJuiceStakingView public immutable staking;

    error Soulbound();

    constructor(address _boys, address _staking)
        ERC721("BoyMeetsHood Staked", "sBOYS")
    {
        boys = IBoys(_boys);
        staking = IJuiceStakingView(_staking);
    }

    /* ─────────────────────────── Reconcile ─────────────────────────────── */

    /// @notice Bring the receipts for explicit token IDs in line with staking.
    /// @dev Permissionless — reads JuiceStaking, so it can only tell the truth.
    function sync(uint256[] calldata tokenIds) external {
        for (uint256 i; i < tokenIds.length; ++i) _syncOne(tokenIds[i]);
    }

    /// @notice Reconcile a contiguous id range (inclusive). For one-off backfill
    ///         or a keeper sweeping the collection.
    function syncRange(uint256 fromId, uint256 toId) external {
        for (uint256 id = fromId; id <= toId; ++id) _syncOne(id);
    }

    /// @notice Mint any of a wallet's currently-staked Boys that aren't yet
    ///         represented (does not burn — use sync/syncRange for that).
    function syncUser(address user) external {
        uint256[] memory ids = staking.getUserStakes(user);
        for (uint256 i; i < ids.length; ++i) _syncOne(ids[i]);
    }

    function _syncOne(uint256 tokenId) internal {
        StakeInfo memory s = staking.getStake(tokenId);
        address current = _ownerOf(tokenId); // address(0) if not minted
        if (s.isStaked) {
            if (current == s.owner) return; // already correct
            if (current != address(0)) _burn(tokenId); // re-staked by someone else
            _mint(s.owner, tokenId);
        } else if (current != address(0)) {
            _burn(tokenId); // no longer staked
        }
    }

    /* ─────────────────────────── Views ─────────────────────────────────── */

    /// @notice Mirrors the real Boy's metadata so the receipt displays correctly.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return boys.tokenURI(tokenId);
    }

    /* ─────────────────────────── Soulbound ─────────────────────────────── */

    /// @dev Allow only mint (from == 0) and burn (to == 0); block transfers.
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }
}
