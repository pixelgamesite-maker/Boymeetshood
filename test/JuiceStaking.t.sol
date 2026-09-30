// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {JuiceToken} from "../contracts/JuiceToken.sol";
import {JuiceStaking} from "../contracts/JuiceStaking.sol";

contract MockBoys is ERC721 {
    constructor() ERC721("BoyMeetsHood", "BOY") {}

    function mint(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }
}

/// A holder contract with no onERC721Received — safeTransferFrom into it fails.
contract BlindHolder {
    function approveAll(MockBoys boys, address operator) external {
        boys.setApprovalForAll(operator, true);
    }

    function stake(JuiceStaking staking, uint256 tokenId) external {
        staking.stake(tokenId);
    }

    function unstake(JuiceStaking staking, uint256 tokenId) external {
        staking.unstake(tokenId);
    }
}

contract JuiceStakingTest is Test {
    JuiceToken internal juice;
    JuiceStaking internal staking;
    MockBoys internal boys;

    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    // Round number chosen purely so per-day math in these tests is exact and
    // easy to read; the real deploy script uses the client's target rate.
    uint256 internal constant BASE_DAILY_REWARD = 1_000e18;

    /// @dev Storage, not a local — a local variable snapshotting
    /// `block.timestamp` gets silently rewritten by solc's via-ir optimizer
    /// once the function
    /// both calls `vm.warp` and makes an external call (e.g. a staking
    /// action): later reads of that local return the POST-warp timestamp
    /// instead of the originally captured value, so a second
    /// `vm.warp(_t0 + N days)` ends up warping N days past the *previous*
    /// warp target, not past the real start. Empirically verified in this
    /// repo; a storage variable is not affected. Every test that needs a
    /// fixed reference point across more than one vm.warp must use this,
    /// not a local.
    uint256 internal _t0;

    function setUp() public {
        boys = new MockBoys();
        juice = new JuiceToken(owner);

        vm.prank(owner);
        staking = new JuiceStaking(owner, address(boys), address(juice), treasury, BASE_DAILY_REWARD);

        vm.prank(owner);
        juice.authorizeMinter(address(staking));

        for (uint256 i = 1; i <= 30; i++) {
            boys.mint(alice, i);
        }
        for (uint256 i = 31; i <= 40; i++) {
            boys.mint(bob, i);
        }

        vm.prank(alice);
        boys.setApprovalForAll(address(staking), true);
        vm.prank(bob);
        boys.setApprovalForAll(address(staking), true);
    }

    /* ─────────────────────────── Helpers ──────────────────────────── */

    function _setRarity(uint256 tokenId, string memory rarity) internal {
        vm.prank(owner);
        staking.setTokenRarity(tokenId, rarity);
    }

    function _stake(address who, uint256 tokenId) internal {
        vm.prank(who);
        staking.stake(tokenId);
    }

    /* ══════════════════════ Continuous accrual ══════════════════════ */
    // No duration, no lock: reward is always currentRate * elapsed time
    // since the last claim, at whatever rarity multiplier applies today.

    function test_Accrual_OneDayCommon() public {
        _setRarity(1, "Common");
        _stake(alice, 1);

        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        staking.claimRewards(1);

        assertEq(juice.balanceOf(alice), 1_000e18);
    }

    function test_Accrual_HalfDay() public {
        _setRarity(1, "Common");
        _stake(alice, 1);

        vm.warp(block.timestamp + 12 hours);
        vm.prank(alice);
        staking.claimRewards(1);

        assertEq(juice.balanceOf(alice), 500e18);
    }

    function test_Accrual_RarityMultiplier_Mythic() public {
        _setRarity(1, "Mythic");
        _stake(alice, 1);

        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        staking.claimRewards(1);

        // 1000 * 2.5
        assertEq(juice.balanceOf(alice), 2_500e18);
    }

    function test_Accrual_RarityMultiplier_Rare() public {
        _setRarity(1, "Rare");
        _stake(alice, 1);

        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        staking.claimRewards(1);

        // 1000 * 1.35
        assertEq(juice.balanceOf(alice), 1_350e18);
    }

    /// Claiming repeatedly must sum to the same total as one big claim over
    /// the same total elapsed time.
    function test_Accrual_MultipleClaimsSumCorrectly() public {
        _setRarity(1, "Common");
        _t0 = block.timestamp;
        _stake(alice, 1);

        vm.warp(_t0 + 1 days);
        vm.prank(alice);
        staking.claimRewards(1);
        assertEq(juice.balanceOf(alice), 1_000e18);

        vm.warp(_t0 + 3 days);
        vm.prank(alice);
        staking.claimRewards(1);
        assertEq(juice.balanceOf(alice), 3_000e18);
    }

    /// Leaving a stake unclaimed for a long time keeps accruing — there's no
    /// cap, unlike the old fixed-term design.
    function test_Accrual_KeepsGrowingPastAnyFixedTerm() public {
        _setRarity(1, "Common");
        _stake(alice, 1);

        vm.warp(block.timestamp + 400 days);
        vm.prank(alice);
        staking.claimRewards(1);

        assertEq(juice.balanceOf(alice), 400_000e18);
    }

    function testFuzz_Accrual_MatchesElapsedTime(uint32 secondsElapsed) public {
        uint256 elapsed = bound(secondsElapsed, 1, 730 days);
        _setRarity(1, "Common");
        _stake(alice, 1);

        vm.warp(block.timestamp + elapsed);
        vm.prank(alice);
        staking.claimRewards(1);

        assertEq(juice.balanceOf(alice), (BASE_DAILY_REWARD * elapsed) / 1 days);
    }

    /* ═══════════════════════════ Stake / unstake ═══════════════════════════ */

    function test_Stake_TransfersNftIntoContract() public {
        _setRarity(1, "Common");
        _stake(alice, 1);

        assertEq(boys.ownerOf(1), address(staking));
    }

    function test_Stake_RevertsIfRarityNotSet() public {
        vm.prank(alice);
        vm.expectRevert(JuiceStaking.RarityNotSet.selector);
        staking.stake(1);
    }

    function test_Stake_RevertsIfNotOwner() public {
        _setRarity(31, "Common");
        vm.prank(alice);
        vm.expectRevert(JuiceStaking.NotTokenOwner.selector);
        staking.stake(31); // owned by bob
    }

    function test_Stake_RevertsIfAlreadyStaked() public {
        _setRarity(1, "Common");
        _stake(alice, 1);

        vm.prank(alice);
        vm.expectRevert(JuiceStaking.AlreadyStaked.selector);
        staking.stake(1);
    }

    /// The headline change from the old design: no lock, so this must
    /// succeed immediately with zero elapsed time and zero reward.
    function test_Unstake_WorksImmediatelyNoLock() public {
        _setRarity(1, "Common");
        _stake(alice, 1);

        vm.prank(alice);
        staking.unstake(1);

        assertEq(boys.ownerOf(1), alice);
        assertEq(juice.balanceOf(alice), 0);
    }

    function test_Unstake_RevertsForNonOwner() public {
        _setRarity(1, "Common");
        _stake(alice, 1);

        vm.prank(bob);
        vm.expectRevert(JuiceStaking.NotStakeOwner.selector);
        staking.unstake(1);
    }

    function test_Unstake_RevertsIfNotStaked() public {
        vm.prank(alice);
        vm.expectRevert(JuiceStaking.NotStaked.selector);
        staking.unstake(1);
    }

    function test_Unstake_ReturnsNftAndMintsAccruedRewards() public {
        _setRarity(1, "Common");
        _stake(alice, 1);

        vm.warp(block.timestamp + 3 days);
        vm.prank(alice);
        staking.unstake(1);

        assertEq(boys.ownerOf(1), alice);
        assertEq(juice.balanceOf(alice), 3_000e18);
    }

    function test_Unstake_AfterPartialClaimMintsOnlyRemainder() public {
        _setRarity(1, "Common");
        _t0 = block.timestamp;
        _stake(alice, 1);

        vm.warp(_t0 + 1 days);
        vm.prank(alice);
        staking.claimRewards(1);

        vm.warp(_t0 + 3 days);
        vm.prank(alice);
        staking.unstake(1);

        // 1 day claimed + 2 days at unstake = 3 days total, never double-counted.
        assertEq(juice.balanceOf(alice), 3_000e18);
    }

    function test_StakeRemovedFromUserStakesAfterUnstake() public {
        _setRarity(1, "Common");
        _setRarity(2, "Common");
        _stake(alice, 1);
        _stake(alice, 2);

        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        staking.unstake(1);

        uint256[] memory remaining = staking.getUserStakes(alice);
        assertEq(remaining.length, 1);
        assertEq(remaining[0], 2);
    }

    /// After unstaking and restaking the same token, accrual starts fresh
    /// from zero — no leftover credit from the previous stake.
    function test_Restake_StartsAccrualFresh() public {
        _setRarity(1, "Common");
        _stake(alice, 1);

        vm.warp(block.timestamp + 5 days);
        vm.prank(alice);
        staking.unstake(1); // mints 5_000e18

        vm.prank(alice);
        staking.stake(1);

        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        staking.claimRewards(1);

        assertEq(juice.balanceOf(alice), 6_000e18); // 5_000 + 1_000, not 6_000 + leftover
    }

    /* ═══════════════════════════ Claim all ═══════════════════════════ */

    function test_ClaimAllRewards_AcrossMultipleStakes() public {
        _setRarity(1, "Common");
        _setRarity(2, "Legendary");
        _stake(alice, 1);
        _stake(alice, 2);

        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        staking.claimAllRewards();

        // 1000 (Common) + 2000 (Legendary 2x) = 3000
        assertEq(juice.balanceOf(alice), 3_000e18);
    }

    function test_ClaimAllRewards_OnlyClaimsCallersStakes() public {
        _setRarity(1, "Common");
        _setRarity(31, "Common");
        _stake(alice, 1);
        _stake(bob, 31);

        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        staking.claimAllRewards();

        assertEq(juice.balanceOf(alice), 1_000e18);
        assertEq(juice.balanceOf(bob), 0);
    }

    function test_ClaimAllRewards_RevertsWithNothingStaked() public {
        vm.prank(alice);
        vm.expectRevert(JuiceStaking.NotStaked.selector);
        staking.claimAllRewards();
    }

    function test_ClaimRewards_RevertsWithNothingToClaim() public {
        _setRarity(1, "Common");
        _stake(alice, 1);

        // No time has passed.
        vm.prank(alice);
        vm.expectRevert(JuiceStaking.NothingToClaim.selector);
        staking.claimRewards(1);
    }

    /* ═══════════════════════════ Batch staking ═══════════════════════════ */

    function test_StakeAll_StakesEveryToken() public {
        _setRarity(1, "Common");
        _setRarity(2, "Common");
        _setRarity(3, "Common");

        uint256[] memory ids = new uint256[](3);
        ids[0] = 1;
        ids[1] = 2;
        ids[2] = 3;

        vm.prank(alice);
        staking.stakeAll(ids);

        assertEq(boys.ownerOf(1), address(staking));
        assertEq(boys.ownerOf(2), address(staking));
        assertEq(boys.ownerOf(3), address(staking));
        assertEq(staking.getUserStakes(alice).length, 3);
    }

    function test_StakeAll_RevertsOnEmptyBundle() public {
        uint256[] memory ids = new uint256[](0);
        vm.prank(alice);
        vm.expectRevert(JuiceStaking.BadBundle.selector);
        staking.stakeAll(ids);
    }

    function test_StakeAll_RevertsOverMaxBatch() public {
        uint256 max = staking.MAX_BATCH();
        uint256[] memory ids = new uint256[](max + 1);
        vm.prank(alice);
        vm.expectRevert(JuiceStaking.BadBundle.selector);
        staking.stakeAll(ids);
    }

    /* ═══════════════════════════ Fees ═══════════════════════════ */

    function test_Fees_DefaultToZero() public view {
        assertEq(staking.stakeFee(), 0);
    }

    function test_Fees_ZeroMeansStakingNeedsNoValue() public {
        _setRarity(1, "Common");
        vm.prank(alice);
        staking.stake(1); // no ETH sent, should still work

        assertEq(boys.ownerOf(1), address(staking));
    }

    function test_Fees_StakeRevertsWhenUnderpaid() public {
        vm.prank(owner);
        staking.setFees(0.001 ether);

        _setRarity(1, "Common");
        vm.prank(alice);
        vm.expectRevert(JuiceStaking.InsufficientFee.selector);
        staking.stake(1);
    }

    function test_Fees_ForwardedToTreasury() public {
        vm.prank(owner);
        staking.setFees(0.001 ether);

        _setRarity(1, "Common");
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        staking.stake{value: 0.001 ether}(1);

        assertEq(treasury.balance, 0.001 ether);
    }

    function test_Fees_OnlyOwnerCanSet() public {
        vm.prank(alice);
        vm.expectRevert();
        staking.setFees(1 ether);
    }

    /* ═══════════════════════════ Reward-rate admin ═══════════════════════════ */

    function test_SetBaseDailyReward_ChangesFutureRate() public {
        _setRarity(1, "Common");
        _stake(alice, 1);

        vm.prank(owner);
        staking.setBaseDailyReward(2_000e18);

        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        staking.claimRewards(1);

        assertEq(juice.balanceOf(alice), 2_000e18);
    }

    /// The trade-off documented on the contract: a rate change applies to
    /// the WHOLE unclaimed window, including time already staked before the
    /// change, since nothing is checkpointed per-second on-chain.
    function test_SetBaseDailyReward_AppliesRetroactivelyToUnclaimedWindow() public {
        _setRarity(1, "Common");
        _t0 = block.timestamp;
        _stake(alice, 1);

        vm.warp(_t0 + 1 days); // 1 day accrued at the OLD rate, not yet claimed
        vm.prank(owner);
        staking.setBaseDailyReward(2_000e18);

        vm.warp(_t0 + 2 days); // 1 more day accrued at the NEW rate
        vm.prank(alice);
        staking.claimRewards(1);

        // All 2 days priced at the new 2000/day rate: 4000, not 1000 + 2000.
        assertEq(juice.balanceOf(alice), 4_000e18);
    }

    /// Claiming before the change locks in the old rate for that stretch —
    /// the mitigation the contract's NatSpec points to.
    function test_ClaimBeforeRateChange_LocksInOldRateForThatStretch() public {
        _setRarity(1, "Common");
        _t0 = block.timestamp;
        _stake(alice, 1);

        vm.warp(_t0 + 1 days);
        vm.prank(alice);
        staking.claimRewards(1); // locks in 1000e18 at the old rate

        vm.prank(owner);
        staking.setBaseDailyReward(2_000e18);

        vm.warp(_t0 + 2 days);
        vm.prank(alice);
        staking.claimRewards(1);

        assertEq(juice.balanceOf(alice), 1_000e18 + 2_000e18);
    }

    function test_SetBaseDailyReward_OnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        staking.setBaseDailyReward(1);
    }

    function test_DailyRewardRate_ReflectsRarity() public {
        _setRarity(1, "Epic");
        assertEq(staking.dailyRewardRate(1), 1_600e18); // 1000 * 1.6
    }

    /* ═══════════════════════════ Rarity admin ═══════════════════════════ */

    function test_BatchSetRarity() public {
        uint256[] memory ids = new uint256[](2);
        ids[0] = 1;
        ids[1] = 2;
        string[] memory rarities = new string[](2);
        rarities[0] = "Mythic";
        rarities[1] = "Uncommon";

        vm.prank(owner);
        staking.batchSetRarity(ids, rarities);

        assertEq(staking.tokenRarity(1), "Mythic");
        assertEq(staking.tokenRarity(2), "Uncommon");
    }

    function test_BatchSetRarity_RevertsOnLengthMismatch() public {
        uint256[] memory ids = new uint256[](2);
        string[] memory rarities = new string[](1);

        vm.prank(owner);
        vm.expectRevert(JuiceStaking.BadBundle.selector);
        staking.batchSetRarity(ids, rarities);
    }

    function test_SetTokenRarity_OnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        staking.setTokenRarity(1, "Mythic");
    }

    /// Same trade-off as setBaseDailyReward: a rarity correction applies to
    /// the stake's whole unclaimed window, not just time going forward.
    function test_RarityChange_AppliesToWholeUnclaimedWindow() public {
        _setRarity(1, "Common");
        _t0 = block.timestamp;
        _stake(alice, 1);

        vm.warp(_t0 + 1 days);
        _setRarity(1, "Mythic");

        vm.warp(_t0 + 2 days);
        vm.prank(alice);
        staking.claimRewards(1);

        // Both days priced at Mythic (2.5x): 2 * 1000 * 2.5 = 5000.
        assertEq(juice.balanceOf(alice), 5_000e18);
    }

    /* ═══════════════════════════ Pause ═══════════════════════════ */

    function test_Pause_BlocksNewStakes() public {
        _setRarity(1, "Common");
        vm.prank(owner);
        staking.pause();

        vm.prank(alice);
        vm.expectRevert();
        staking.stake(1);
    }

    function test_Pause_DoesNotTrapStakedNfts() public {
        _setRarity(1, "Common");
        _stake(alice, 1);

        vm.prank(owner);
        staking.pause();

        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        staking.unstake(1);

        assertEq(boys.ownerOf(1), alice);
    }

    /* ═══════════════════════════ Receiver safety ═══════════════════════════ */

    function test_BlindContractCanStillReceiveBackViaUnstake() public {
        BlindHolder blind = new BlindHolder();
        boys.mint(address(blind), 100);
        blind.approveAll(boys, address(staking));

        _setRarity(100, "Common");
        blind.stake(staking, 100);

        vm.warp(block.timestamp + 1 days);
        blind.unstake(staking, 100);

        assertEq(boys.ownerOf(100), address(blind));
    }

    /* ═══════════════════════════ Constructor ═══════════════════════════ */

    function test_Constructor_RevertsOnZeroAddress() public {
        vm.expectRevert(JuiceStaking.ZeroAddress.selector);
        new JuiceStaking(owner, address(0), address(juice), treasury, BASE_DAILY_REWARD);
    }

    function test_Constructor_SetsBaseDailyReward() public view {
        assertEq(staking.baseDailyReward(), BASE_DAILY_REWARD);
    }

    function test_Constructor_SeedsRarityMultipliers() public view {
        assertEq(staking.rarityMultiplierBps("Common"), 10_000);
        assertEq(staking.rarityMultiplierBps("Uncommon"), 11_500);
        assertEq(staking.rarityMultiplierBps("Rare"), 13_500);
        assertEq(staking.rarityMultiplierBps("Epic"), 16_000);
        assertEq(staking.rarityMultiplierBps("Legendary"), 20_000);
        assertEq(staking.rarityMultiplierBps("Mythic"), 25_000);
    }
}
