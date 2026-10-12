// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title BoysGatingAdapter
 * @notice Read-only shim for Discord token-gating (Vulcan, Collab.Land, etc.).
 *
 * Staking moves a Boy out of the holder's wallet into JuiceStaking, so a plain
 * `balanceOf` on the Boys collection reads 0 for a staker and the bot revokes
 * their role. This contract exposes an ERC-721-shaped `balanceOf(address)` that
 * reports a wallet's **held + staked** Boys, so point the gating rule at this
 * address and stakers keep their role.
 *
 * It is non-custodial and stateless: it holds nothing, can move nothing, and
 * only reads the two live contracts. Nothing here can affect staking or funds.
 */
interface IERC721Balance {
    function balanceOf(address owner) external view returns (uint256);
}

interface IJuiceStakingView {
    function getUserStakes(address user) external view returns (uint256[] memory);
}

contract BoysGatingAdapter {
    /// @notice The Boys ERC-721 collection.
    IERC721Balance public immutable boys;
    /// @notice The JuiceStaking contract holding staked Boys.
    IJuiceStakingView public immutable staking;

    string public constant name = "BoyMeetsHood (held + staked)";
    string public constant symbol = "BOYS";

    constructor(address _boys, address _staking) {
        boys = IERC721Balance(_boys);
        staking = IJuiceStakingView(_staking);
    }

    /**
     * @notice Boys this wallet effectively holds: in-wallet plus currently
     *         staked. `getUserStakes` is pruned on unstake, so its length is
     *         exactly the wallet's active stake count.
     * @dev View only — gating bots read this over eth_call at no cost.
     */
    function balanceOf(address owner) external view returns (uint256) {
        return boys.balanceOf(owner) + staking.getUserStakes(owner).length;
    }

    /// @notice Just the staked portion, if a rule wants to count it separately.
    function stakedBalanceOf(address owner) external view returns (uint256) {
        return staking.getUserStakes(owner).length;
    }
}
