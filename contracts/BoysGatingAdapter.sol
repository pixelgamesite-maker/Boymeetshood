// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title BoysGatingAdapter
 * @notice A read-only ERC-721 *facade* over the Boys collection for Discord
 *         token-gating (Vulcan, Collab.Land, etc.).
 *
 * Staking moves a Boy out of the holder's wallet into JuiceStaking, so a plain
 * `balanceOf` on the real collection reads 0 for a staker and the gating bot
 * revokes their role. This contract presents as a normal ERC-721 — it answers
 * `supportsInterface`, `name`, `symbol`, `tokenURI`, `totalSupply` and
 * `ownerOf` so gating tools accept it as a collection — but its `balanceOf`
 * (and `ownerOf`) count a wallet's **held + staked** Boys. Point the gating
 * rule at this address and stakers keep their role.
 *
 * It is non-custodial and stateless: it holds nothing, can transfer nothing,
 * and only reads the two live contracts. Nothing here can affect staking or
 * funds. There is deliberately no transfer/approve surface — this is a
 * read-only view, not a tradeable token.
 */
interface IBoys {
    function balanceOf(address owner) external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
    function tokenURI(uint256 tokenId) external view returns (string memory);
    function totalSupply() external view returns (uint256);
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
    function getUserStakes(address user) external view returns (uint256[] memory);
    function getStake(uint256 tokenId) external view returns (StakeInfo memory);
}

contract BoysGatingAdapter {
    /// @notice The Boys ERC-721 collection.
    IBoys public immutable boys;
    /// @notice The JuiceStaking contract holding staked Boys.
    IJuiceStakingView public immutable staking;

    string public constant name = "BoyMeetsHood (held + staked)";
    string public constant symbol = "BOYS";

    constructor(address _boys, address _staking) {
        boys = IBoys(_boys);
        staking = IJuiceStakingView(_staking);
    }

    /// @notice Advertise ERC-165, ERC-721 and ERC-721 Metadata so gating tools
    ///         recognise this as an NFT collection.
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return
            interfaceId == 0x01ffc9a7 || // ERC-165
            interfaceId == 0x80ac58cd || // ERC-721
            interfaceId == 0x5b5e139f; // ERC-721 Metadata
    }

    /**
     * @notice Boys this wallet effectively holds: in-wallet plus currently
     *         staked. `getUserStakes` is pruned on unstake, so its length is
     *         exactly the wallet's active stake count.
     */
    function balanceOf(address owner) external view returns (uint256) {
        return boys.balanceOf(owner) + staking.getUserStakes(owner).length;
    }

    /// @notice Just the staked portion, if a rule wants to count it separately.
    function stakedBalanceOf(address owner) external view returns (uint256) {
        return staking.getUserStakes(owner).length;
    }

    /**
     * @notice Effective owner of a token: the staker while it's staked (the
     *         real collection would report the staking contract), otherwise the
     *         real on-chain owner.
     */
    function ownerOf(uint256 tokenId) external view returns (address) {
        StakeInfo memory s = staking.getStake(tokenId);
        if (s.isStaked) return s.owner;
        return boys.ownerOf(tokenId);
    }

    /// @notice Proxies the real collection's metadata URI.
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        return boys.tokenURI(tokenId);
    }

    /// @notice Proxies the real collection's supply.
    function totalSupply() external view returns (uint256) {
        return boys.totalSupply();
    }
}
