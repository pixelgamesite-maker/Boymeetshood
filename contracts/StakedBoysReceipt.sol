// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

interface IBoys {
    function ownerOf(uint256 tokenId) external view returns (address);
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
    /// @notice The Boys ERC-721 collection (source of truth for wallet holders).
    IBoys public immutable boys;
    /// @notice The JuiceStaking contract (source of truth for stakers).
    IJuiceStakingView public immutable staking;

    error Soulbound();

    constructor(address _boys, address _staking)
        ERC721("BoyMeetsHood (held + staked)", "BOYS")
    {
        boys = IBoys(_boys);
        staking = IJuiceStakingView(_staking);
    }

    /* ─────────────────────────── Reconcile ─────────────────────────────── */

    /// @notice Bring the receipts for explicit token IDs in line with the chain.
    /// @dev Permissionless — reads the real collection + staking, so it can only
    ///      tell the truth.
    function sync(uint256[] calldata tokenIds) external {
        for (uint256 i; i < tokenIds.length; ++i) _syncOne(tokenIds[i]);
    }

    /// @notice Reconcile a contiguous id range (inclusive). For one-off backfill
    ///         or a keeper sweeping the whole collection.
    function syncRange(uint256 fromId, uint256 toId) external {
        for (uint256 id = fromId; id <= toId; ++id) _syncOne(id);
    }

    /// @notice The address that effectively controls a Boy: the staker if it's
    ///         staked, otherwise the current wallet owner.
    function effectiveOwner(uint256 tokenId) public view returns (address) {
        StakeInfo memory s = staking.getStake(tokenId);
        if (s.isStaked) return s.owner;
        return boys.ownerOf(tokenId);
    }

    function _syncOne(uint256 tokenId) internal {
        address target = effectiveOwner(tokenId);
        address current = _ownerOf(tokenId); // address(0) if not minted
        if (current == target) return; // already correct
        if (current != address(0)) _burn(tokenId);
        _mint(target, tokenId);
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
