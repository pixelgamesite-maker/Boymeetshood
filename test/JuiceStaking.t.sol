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

contract BlindHolder {
    function approveAll(MockBoys boys, address operator) external {
        boys.setApprovalForAll(operator, true);
    }

    function stake(JuiceStaking staking, uint256 tokenId, uint256 durationDays) external {
        staking.stake(tokenId, durationDays);
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

    uint256 internal constant BASE_DAILY_REWARD = 1_000e18;

    // Lock tiers, in days.
    uint256 internal constant D1 = 30; // 0.5x
    uint256 internal constant D3 = 90; // 1x
    uint256 internal constant D6 = 180; // 1.5x
    uint256 internal constant D12 = 365; // 2.5x

    /// @dev Storage, not a local — dodges the via-ir CSE pitfall where a local
    /// block.timestamp snapshot is rewritten across vm.warp + an external call.
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

    function _stake(address who, uint256 tokenId, uint256 d) internal {
        vm.prank(who);
        staking.stake(tokenId, d);
    }

    /* ══════════════════ Accrual: rarity x duration ══════════════════ */

    function test_Accrual_OneMonth_HalfRate() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D1);
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        staking.claimRewards(1);
        assertEq(juice.balanceOf(alice), 500e18); // 1000 * 1x * 0.5x
    }

    function test_Accrual_ThreeMonth_BaseRate() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D3);
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        staking.claimRewards(1);
        assertEq(juice.balanceOf(alice), 1_000e18);
    }

    function test_Accrual_SixMonth() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D6);
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        staking.claimRewards(1);
        assertEq(juice.balanceOf(alice), 1_500e18);
    }

    function test_Accrual_TwelveMonth() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D12);
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        staking.claimRewards(1);
        assertEq(juice.balanceOf(alice), 2_500e18);
    }

    function test_Accrual_RarityAndDurationStack() public {
        _setRarity(1, "Rare"); // 1.35x
        _stake(alice, 1, D6); // 1.5x
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        staking.claimRewards(1);
        assertEq(juice.balanceOf(alice), 2_025e18);
    }

    /* ══════════════════ Lock enforcement ══════════════════ */

    function test_Unstake_RevertsWhileLocked() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D1);
        vm.warp(block.timestamp + 29 days);
        vm.prank(alice);
        vm.expectRevert(JuiceStaking.StillLocked.selector);
        staking.unstake(1);
    }

    function test_OneMonthUnlocksAt30Days() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D1);
        vm.warp(block.timestamp + 30 days);
        vm.prank(alice);
        staking.unstake(1);
        assertEq(boys.ownerOf(1), alice);
        assertEq(juice.balanceOf(alice), 30 * 500e18); // 30d at 500/day
    }

    function test_TwelveMonthUnlocksAt365Days() public {
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

    function test_Claim_DuringLock_ButStillLocked() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D3);
        vm.warp(block.timestamp + 10 days);
        vm.prank(alice);
        staking.claimRewards(1);
        assertEq(juice.balanceOf(alice), 10 * 1_000e18);
        vm.prank(alice);
        vm.expectRevert(JuiceStaking.StillLocked.selector);
        staking.unstake(1);
    }

    function test_Accrual_CapsAtUnlock() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D1); // 30-day term
        vm.warp(block.timestamp + 200 days);
        assertEq(staking.calculateRewards(1), 30 * 500e18);
        vm.prank(alice);
        staking.unstake(1);
        assertEq(juice.balanceOf(alice), 30 * 500e18);
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
    }

    /* ══════════════════ Rate snapshot ══════════════════ */

    function test_RateSnapshot_BaseChangeDoesNotAffectRunningStake() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D3);
        vm.prank(owner);
        staking.setBaseDailyReward(2_000e18);
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        staking.claimRewards(1);
        assertEq(juice.balanceOf(alice), 1_000e18);
    }

    /* ══════════════════ Editable durations ══════════════════ */

    function test_Constructor_SeedsDurations() public view {
        uint256[] memory ds = staking.getDurations();
        assertEq(ds.length, 4);
        assertEq(staking.durationMultiplierBps(30), 5_000);
        assertEq(staking.durationMultiplierBps(90), 10_000);
        assertEq(staking.durationMultiplierBps(180), 15_000);
        assertEq(staking.durationMultiplierBps(365), 25_000);
    }

    function test_Stake_RevertsOnUnknownDuration() public {
        _setRarity(1, "Common");
        vm.prank(alice);
        vm.expectRevert(JuiceStaking.BadDuration.selector);
        staking.stake(1, 45); // not a seeded tier
    }

    function test_SetDuration_AddsNewTier() public {
        // Add a 14-day tier at 0.75x — no redeploy.
        vm.prank(owner);
        staking.setDuration(14, 7_500);
        assertEq(staking.getDurations().length, 5);
        assertEq(staking.durationMultiplierBps(14), 7_500);

        _setRarity(1, "Common");
        _stake(alice, 1, 14);
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        staking.claimRewards(1);
        assertEq(juice.balanceOf(alice), 750e18); // 1000 * 0.75
    }

    function test_SetDuration_RemovesTier() public {
        vm.prank(owner);
        staking.setDuration(30, 0); // remove 1-month
        assertEq(staking.durationMultiplierBps(30), 0);
        assertEq(staking.getDurations().length, 3);

        _setRarity(1, "Common");
        vm.prank(alice);
        vm.expectRevert(JuiceStaking.BadDuration.selector);
        staking.stake(1, 30);
    }

    function test_SetDuration_RetuneExisting_NoListGrowth() public {
        vm.prank(owner);
        staking.setDuration(90, 12_000); // retune 3-month to 1.2x
        assertEq(staking.getDurations().length, 4); // unchanged
        assertEq(staking.durationMultiplierBps(90), 12_000);
    }

    function test_SetDuration_OnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        staking.setDuration(7, 1_000);
    }

    /* ══════════════════ Quotes ══════════════════ */

    function test_QuoteDailyRate() public {
        _setRarity(1, "Epic"); // 1.6x
        assertEq(staking.quoteDailyRate(1, D1), 800e18); // 1000 * 1.6 * 0.5
        assertEq(staking.quoteDailyRate(1, D3), 1_600e18); // * 1
        assertEq(staking.quoteDailyRate(1, D12), 4_000e18); // * 2.5
    }

    function test_QuoteDailyRate_RevertsOnBadDuration() public {
        _setRarity(1, "Common");
        vm.expectRevert(JuiceStaking.BadDuration.selector);
        staking.quoteDailyRate(1, 45);
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
        staking.stake(31, D3);
    }

    function test_Stake_RevertsIfAlreadyStaked() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D3);
        vm.prank(alice);
        vm.expectRevert(JuiceStaking.AlreadyStaked.selector);
        staking.stake(1, D6);
    }

    function test_Stake_StoresDurationDays() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D6);
        JuiceStaking.StakeInfo memory info = staking.getStake(1);
        assertEq(info.durationDays, 180);
    }

    /* ══════════════════ Batch ══════════════════ */

    function test_StakeAll_WithDuration() public {
        _setRarity(1, "Common");
        _setRarity(2, "Common");
        uint256[] memory ids = new uint256[](2);
        ids[0] = 1;
        ids[1] = 2;
        vm.prank(alice);
        staking.stakeAll(ids, D6);
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        staking.claimAllRewards();
        assertEq(juice.balanceOf(alice), 2 * 1_500e18);
    }

    function test_StakeAll_RevertsOnEmptyBundle() public {
        uint256[] memory ids = new uint256[](0);
        vm.prank(alice);
        vm.expectRevert(JuiceStaking.BadBundle.selector);
        staking.stakeAll(ids, D3);
    }

    function test_ClaimAll_MixedDurations() public {
        _setRarity(1, "Common");
        _setRarity(2, "Common");
        _stake(alice, 1, D1); // 500/day
        _stake(alice, 2, D12); // 2500/day
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        staking.claimAllRewards();
        assertEq(juice.balanceOf(alice), 500e18 + 2_500e18);
    }

    /* ══════════════════ Fees ══════════════════ */

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

    /* ══════════════════ Pause / receiver ══════════════════ */

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
        _stake(alice, 1, D1);
        vm.prank(owner);
        staking.pause();
        vm.warp(block.timestamp + 30 days);
        vm.prank(alice);
        staking.unstake(1);
        assertEq(boys.ownerOf(1), alice);
    }

    function test_BlindContractCanReceiveBackViaUnstake() public {
        BlindHolder blind = new BlindHolder();
        boys.mint(address(blind), 100);
        blind.approveAll(boys, address(staking));
        _setRarity(100, "Common");
        blind.stake(staking, 100, D1);
        vm.warp(block.timestamp + 30 days);
        blind.unstake(staking, 100);
        assertEq(boys.ownerOf(100), address(blind));
    }

    /* ══════════════════ Constructor ══════════════════ */

    function test_Constructor_RevertsOnZeroAddress() public {
        vm.expectRevert(JuiceStaking.ZeroAddress.selector);
        new JuiceStaking(owner, address(0), address(juice), treasury, BASE_DAILY_REWARD);
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
