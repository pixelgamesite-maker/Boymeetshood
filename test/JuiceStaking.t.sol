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

    function stake(JuiceStaking staking, uint256 tokenId, JuiceStaking.Duration duration) external {
        staking.stake(tokenId, duration);
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

    // Round number so per-day math is exact and readable.
    uint256 internal constant BASE_DAILY_REWARD = 1_000e18;

    JuiceStaking.Duration internal constant D3 = JuiceStaking.Duration.THREE_MONTHS;
    JuiceStaking.Duration internal constant D6 = JuiceStaking.Duration.SIX_MONTHS;
    JuiceStaking.Duration internal constant D12 = JuiceStaking.Duration.ONE_YEAR;

    /// @dev Storage, not a local — a local snapshot of block.timestamp gets
    /// rewritten by solc's via-ir optimizer once a test both warps and makes
    /// an external call between reads. See repo history; a storage var is safe.
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

    function _stake(address who, uint256 tokenId, JuiceStaking.Duration d) internal {
        vm.prank(who);
        staking.stake(tokenId, d);
    }

    /* ══════════════════ Accrual: rarity x duration ══════════════════ */

    function test_Accrual_Common3mo_OneDay() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D3);
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        staking.claimRewards(1);
        assertEq(juice.balanceOf(alice), 1_000e18); // 1000 * 1x * 1x
    }

    function test_Accrual_6mo_HigherRate() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D6);
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        staking.claimRewards(1);
        assertEq(juice.balanceOf(alice), 1_500e18); // 1000 * 1x * 1.5x
    }

    function test_Accrual_12mo_HighestRate() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D12);
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        staking.claimRewards(1);
        assertEq(juice.balanceOf(alice), 2_500e18); // 1000 * 1x * 2.5x
    }

    function test_Accrual_RarityAndDurationStack() public {
        _setRarity(1, "Rare"); // 1.35x
        _stake(alice, 1, D6); // 1.5x
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        staking.claimRewards(1);
        assertEq(juice.balanceOf(alice), 2_025e18); // 1000 * 1.35 * 1.5
    }

    function test_Accrual_MythicTwelveMonth() public {
        _setRarity(1, "Mythic"); // 2.5x
        _stake(alice, 1, D12); // 2.5x
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        staking.claimRewards(1);
        assertEq(juice.balanceOf(alice), 6_250e18); // 1000 * 2.5 * 2.5
    }

    /* ══════════════════ Lock enforcement ══════════════════ */

    function test_Unstake_RevertsWhileLocked() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D3);
        vm.warp(block.timestamp + 89 days);
        vm.prank(alice);
        vm.expectRevert(JuiceStaking.StillLocked.selector);
        staking.unstake(1);
    }

    function test_Unstake_WorksAtUnlock() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D3);
        vm.warp(block.timestamp + 90 days);
        vm.prank(alice);
        staking.unstake(1);
        assertEq(boys.ownerOf(1), alice);
        assertEq(juice.balanceOf(alice), 90 * 1_000e18); // 90 days * 1000/day
    }

    function test_SixMonthUnlocksAt180Days() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D6);
        vm.warp(block.timestamp + 179 days);
        vm.prank(alice);
        vm.expectRevert(JuiceStaking.StillLocked.selector);
        staking.unstake(1);

        vm.warp(block.timestamp + 1 days); // 180 total
        vm.prank(alice);
        staking.unstake(1);
        assertEq(boys.ownerOf(1), alice);
    }

    function test_OneYearUnlocksAt365Days() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D12);
        vm.warp(block.timestamp + 364 days);
        vm.prank(alice);
        vm.expectRevert(JuiceStaking.StillLocked.selector);
        staking.unstake(1);

        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        staking.unstake(1);
        assertEq(boys.ownerOf(1), alice);
    }

    /* ══════════════════ Claim during lock, accrual cap ══════════════════ */

    function test_Claim_AnytimeDuringLock_ButStillLocked() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D3);

        vm.warp(block.timestamp + 10 days);
        vm.prank(alice);
        staking.claimRewards(1); // claim mid-term
        assertEq(juice.balanceOf(alice), 10 * 1_000e18);

        // Boy is still locked.
        vm.prank(alice);
        vm.expectRevert(JuiceStaking.StillLocked.selector);
        staking.unstake(1);
    }

    function test_Accrual_CapsAtUnlock() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D3); // 90-day term

        // Sit well past unlock.
        vm.warp(block.timestamp + 200 days);
        // Only the 90-day term accrues, not 200.
        assertEq(staking.calculateRewards(1), 90 * 1_000e18);

        vm.prank(alice);
        staking.unstake(1);
        assertEq(juice.balanceOf(alice), 90 * 1_000e18);
    }

    function test_SplitClaims_SumToTermTotal() public {
        _setRarity(1, "Common");
        _t0 = block.timestamp;
        _stake(alice, 1, D3);

        vm.warp(_t0 + 45 days);
        vm.prank(alice);
        staking.claimRewards(1);
        assertEq(juice.balanceOf(alice), 45 * 1_000e18);

        vm.warp(_t0 + 90 days);
        vm.prank(alice);
        staking.claimRewards(1);
        assertEq(juice.balanceOf(alice), 90 * 1_000e18);

        // Nothing left after the term.
        vm.warp(_t0 + 120 days);
        assertEq(staking.calculateRewards(1), 0);
    }

    /* ══════════════════ Rate snapshot ══════════════════ */

    function test_RateSnapshot_BaseChangeDoesNotAffectRunningStake() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D3); // locked at 1000/day

        vm.prank(owner);
        staking.setBaseDailyReward(2_000e18); // doubles base for FUTURE stakes

        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        staking.claimRewards(1);
        assertEq(juice.balanceOf(alice), 1_000e18); // still the snapshotted rate
    }

    function test_RateSnapshot_NewStakeUsesNewBase() public {
        _setRarity(1, "Common");
        _setRarity(2, "Common");
        _stake(alice, 1, D3); // 1000/day

        vm.prank(owner);
        staking.setBaseDailyReward(2_000e18);
        _stake(alice, 2, D3); // 2000/day

        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        staking.claimAllRewards();
        assertEq(juice.balanceOf(alice), 1_000e18 + 2_000e18);
    }

    /* ══════════════════ Quotes ══════════════════ */

    function test_QuoteDailyRate() public {
        _setRarity(1, "Epic"); // 1.6x
        assertEq(staking.quoteDailyRate(1, D3), 1_600e18); // 1000 * 1.6 * 1
        assertEq(staking.quoteDailyRate(1, D6), 2_400e18); // 1000 * 1.6 * 1.5
        assertEq(staking.quoteDailyRate(1, D12), 4_000e18); // 1000 * 1.6 * 2.5
    }

    function test_QuoteDailyRate_RevertsIfRarityUnset() public {
        vm.expectRevert(JuiceStaking.RarityNotSet.selector);
        staking.quoteDailyRate(1, D3);
    }

    /* ══════════════════ Stake guards ══════════════════ */

    function test_Stake_RevertsIfRarityNotSet() public {
        vm.prank(alice);
        vm.expectRevert(JuiceStaking.RarityNotSet.selector);
        staking.stake(1, D3);
    }

    function test_Stake_RevertsIfNotOwner() public {
        _setRarity(31, "Common");
        vm.prank(alice);
        vm.expectRevert(JuiceStaking.NotTokenOwner.selector);
        staking.stake(31, D3); // bob's
    }

    function test_Stake_RevertsIfAlreadyStaked() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D3);
        vm.prank(alice);
        vm.expectRevert(JuiceStaking.AlreadyStaked.selector);
        staking.stake(1, D6);
    }

    function test_Stake_TransfersNftIntoContract() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D3);
        assertEq(boys.ownerOf(1), address(staking));
    }

    function test_StakeRemovedFromUserStakesAfterUnstake() public {
        _setRarity(1, "Common");
        _setRarity(2, "Common");
        _stake(alice, 1, D3);
        _stake(alice, 2, D3);

        vm.warp(block.timestamp + 90 days);
        vm.prank(alice);
        staking.unstake(1);

        uint256[] memory remaining = staking.getUserStakes(alice);
        assertEq(remaining.length, 1);
        assertEq(remaining[0], 2);
    }

    /* ══════════════════ Batch staking ══════════════════ */

    function test_StakeAll_WithDuration() public {
        _setRarity(1, "Common");
        _setRarity(2, "Common");
        _setRarity(3, "Common");
        uint256[] memory ids = new uint256[](3);
        ids[0] = 1;
        ids[1] = 2;
        ids[2] = 3;

        vm.prank(alice);
        staking.stakeAll(ids, D6);

        assertEq(staking.getUserStakes(alice).length, 3);
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        staking.claimAllRewards();
        assertEq(juice.balanceOf(alice), 3 * 1_500e18); // each 1000 * 1.5
    }

    function test_StakeAll_RevertsOnEmptyBundle() public {
        uint256[] memory ids = new uint256[](0);
        vm.prank(alice);
        vm.expectRevert(JuiceStaking.BadBundle.selector);
        staking.stakeAll(ids, D3);
    }

    function test_StakeAll_RevertsOverMaxBatch() public {
        uint256 max = staking.MAX_BATCH();
        uint256[] memory ids = new uint256[](max + 1);
        vm.prank(alice);
        vm.expectRevert(JuiceStaking.BadBundle.selector);
        staking.stakeAll(ids, D3);
    }

    /* ══════════════════ Claim all ══════════════════ */

    function test_ClaimAll_AcrossMixedDurations() public {
        _setRarity(1, "Common");
        _setRarity(2, "Common");
        _stake(alice, 1, D3); // 1000/day
        _stake(alice, 2, D12); // 2500/day

        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        staking.claimAllRewards();
        assertEq(juice.balanceOf(alice), 1_000e18 + 2_500e18);
    }

    function test_ClaimRewards_RevertsWithNothingToClaim() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D3);
        vm.prank(alice);
        vm.expectRevert(JuiceStaking.NothingToClaim.selector);
        staking.claimRewards(1);
    }

    /* ══════════════════ Fees ══════════════════ */

    function test_Fees_DefaultToZero() public view {
        assertEq(staking.stakeFee(), 0);
    }

    function test_Fees_StakeRevertsWhenUnderpaid() public {
        vm.prank(owner);
        staking.setFees(0.001 ether);
        _setRarity(1, "Common");
        vm.prank(alice);
        vm.expectRevert(JuiceStaking.InsufficientFee.selector);
        staking.stake(1, D3);
    }

    function test_Fees_ForwardedToTreasury() public {
        vm.prank(owner);
        staking.setFees(0.001 ether);
        _setRarity(1, "Common");
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        staking.stake{value: 0.001 ether}(1, D3);
        assertEq(treasury.balance, 0.001 ether);
    }

    /* ══════════════════ Admin ══════════════════ */

    function test_SetDurationMultiplier_AffectsFutureStakes() public {
        _setRarity(1, "Common");
        vm.prank(owner);
        staking.setDurationMultiplier(D3, 20_000); // 2x
        _stake(alice, 1, D3);
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        staking.claimRewards(1);
        assertEq(juice.balanceOf(alice), 2_000e18);
    }

    function test_SetDurationMultiplier_OnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        staking.setDurationMultiplier(D3, 1);
    }

    function test_Constructor_SeedsDurationMultipliers() public view {
        assertEq(staking.durationMultiplierBps(D3), 10_000);
        assertEq(staking.durationMultiplierBps(D6), 15_000);
        assertEq(staking.durationMultiplierBps(D12), 25_000);
    }

    function test_Constructor_SeedsRarityMultipliers() public view {
        assertEq(staking.rarityMultiplierBps("Common"), 10_000);
        assertEq(staking.rarityMultiplierBps("Mythic"), 25_000);
    }

    function test_Constructor_RevertsOnZeroAddress() public {
        vm.expectRevert(JuiceStaking.ZeroAddress.selector);
        new JuiceStaking(owner, address(0), address(juice), treasury, BASE_DAILY_REWARD);
    }

    /* ══════════════════ Pause ══════════════════ */

    function test_Pause_BlocksNewStakes() public {
        _setRarity(1, "Common");
        vm.prank(owner);
        staking.pause();
        vm.prank(alice);
        vm.expectRevert();
        staking.stake(1, D3);
    }

    function test_Pause_DoesNotTrapStakedNfts() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D3);
        vm.prank(owner);
        staking.pause();

        vm.warp(block.timestamp + 90 days);
        vm.prank(alice);
        staking.unstake(1);
        assertEq(boys.ownerOf(1), alice);
    }

    /* ══════════════════ Receiver safety ══════════════════ */

    function test_BlindContractCanStillReceiveBackViaUnstake() public {
        BlindHolder blind = new BlindHolder();
        boys.mint(address(blind), 100);
        blind.approveAll(boys, address(staking));

        _setRarity(100, "Common");
        blind.stake(staking, 100, D3);

        vm.warp(block.timestamp + 90 days);
        blind.unstake(staking, 100);
        assertEq(boys.ownerOf(100), address(blind));
    }

    /* ══════════════════ Fuzz ══════════════════ */

    function testFuzz_Accrual_CapsAtTerm(uint32 secondsElapsed) public {
        uint256 elapsed = bound(secondsElapsed, 1, 400 days);
        _setRarity(1, "Common");
        _stake(alice, 1, D3); // 90-day term, 1000/day
        vm.warp(block.timestamp + elapsed);

        uint256 capped = elapsed > 90 days ? 90 days : elapsed;
        assertEq(staking.calculateRewards(1), (1_000e18 * capped) / 1 days);
    }
}
