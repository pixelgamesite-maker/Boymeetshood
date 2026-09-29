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

    JuiceStaking.Duration internal constant D30 = JuiceStaking.Duration.THIRTY;
    JuiceStaking.Duration internal constant D90 = JuiceStaking.Duration.NINETY;
    JuiceStaking.Duration internal constant D180 = JuiceStaking.Duration.ONE_EIGHTY;
    JuiceStaking.Duration internal constant D365 = JuiceStaking.Duration.THREE_SIXTY_FIVE;

    function setUp() public {
        boys = new MockBoys();
        juice = new JuiceToken(owner);

        vm.prank(owner);
        staking = new JuiceStaking(owner, address(boys), address(juice), treasury);

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

    function _stake(address who, uint256 tokenId, JuiceStaking.Duration duration) internal {
        vm.prank(who);
        staking.stake(tokenId, duration);
    }

    /* ══════════════════════ Exact-payout guarantee ══════════════════════ */
    // The whole point of this reward design: whatever duration/rarity combo
    // you pick, and however many times you claim along the way, the total
    // minted across the full term is exactly the promised amount.

    function test_ExactPayout_Common30Days() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D30);

        vm.warp(block.timestamp + 30 days);
        vm.prank(alice);
        staking.claimRewards(1);

        assertEq(juice.balanceOf(alice), 500e18);
    }

    function test_ExactPayout_Uncommon90Days() public {
        _setRarity(1, "Uncommon");
        _stake(alice, 1, D90);

        vm.warp(block.timestamp + 90 days);
        vm.prank(alice);
        staking.claimRewards(1);

        // 1650 * 1.15 = 1897.5
        assertEq(juice.balanceOf(alice), 1897.5e18);
    }

    function test_ExactPayout_Rare180Days() public {
        _setRarity(1, "Rare");
        _stake(alice, 1, D180);

        vm.warp(block.timestamp + 180 days);
        vm.prank(alice);
        staking.claimRewards(1);

        // 3600 * 1.35 = 4860
        assertEq(juice.balanceOf(alice), 4860e18);
    }

    function test_ExactPayout_Epic365Days() public {
        _setRarity(1, "Epic");
        _stake(alice, 1, D365);

        vm.warp(block.timestamp + 365 days);
        vm.prank(alice);
        staking.claimRewards(1);

        // 10125 * 1.6 = 16200
        assertEq(juice.balanceOf(alice), 16200e18);
    }

    function test_ExactPayout_Legendary30Days() public {
        _setRarity(1, "Legendary");
        _stake(alice, 1, D30);

        vm.warp(block.timestamp + 30 days);
        vm.prank(alice);
        staking.claimRewards(1);

        // 500 * 2 = 1000
        assertEq(juice.balanceOf(alice), 1000e18);
    }

    function test_ExactPayout_Mythic365Days() public {
        _setRarity(1, "Mythic");
        _stake(alice, 1, D365);

        vm.warp(block.timestamp + 365 days);
        vm.prank(alice);
        staking.claimRewards(1);

        // 10125 * 2.5 = 25312.5
        assertEq(juice.balanceOf(alice), 25312.5e18);
    }

    /// Claiming halfway through, then again at maturity, must still sum to
    /// exactly the fixed total — not more, not less.
    function test_ExactPayout_SplitAcrossTwoClaims() public {
        _setRarity(1, "Common");
        // Captured once and reused for every warp below: with via-ir, two
        // textually-identical `block.timestamp + 15 days` expressions in one
        // function get commoned by the optimizer, so the second `vm.warp`
        // would silently reuse the first's (stale) argument. Warping to an
        // absolute time derived from a local avoids that entirely.
        uint256 t0 = block.timestamp;
        _stake(alice, 1, D30);

        vm.warp(t0 + 15 days);
        vm.prank(alice);
        staking.claimRewards(1);
        assertApproxEqAbs(juice.balanceOf(alice), 250e18, 1);

        vm.warp(t0 + 30 days);
        vm.prank(alice);
        staking.claimRewards(1);

        assertEq(juice.balanceOf(alice), 500e18);
    }

    /// Claiming many times along the way must still land exactly on the
    /// fixed total at maturity, regardless of how many small claims happened.
    function testFuzz_ExactPayout_ManySmallClaims(uint8 stepsRaw) public {
        uint256 steps = bound(stepsRaw, 1, 30);
        _setRarity(1, "Rare");
        uint256 t0 = block.timestamp;
        _stake(alice, 1, D30);

        uint256 stepLen = 30 days / steps;
        for (uint256 i = 0; i < steps; i++) {
            // Absolute target from the fixed t0, not `block.timestamp` — see
            // the comment in test_ExactPayout_SplitAcrossTwoClaims.
            vm.warp(t0 + stepLen * (i + 1));
            uint256 pending = staking.calculateRewards(1);
            if (pending > 0) {
                vm.prank(alice);
                staking.claimRewards(1);
            }
        }

        // Mop up any remainder from integer division, then jump to maturity.
        vm.warp(t0 + 30 days);
        uint256 remainder = staking.calculateRewards(1);
        if (remainder > 0) {
            vm.prank(alice);
            staking.claimRewards(1);
        }

        assertEq(juice.balanceOf(alice), 675e18); // 30-day base 500 * Rare 1.35x
    }

    /* ═══════════════════════════ Stake / unstake ═══════════════════════════ */

    function test_Stake_TransfersNftIntoContract() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D30);

        assertEq(boys.ownerOf(1), address(staking));
    }

    function test_Stake_RevertsIfRarityNotSet() public {
        vm.prank(alice);
        vm.expectRevert(JuiceStaking.RarityNotSet.selector);
        staking.stake(1, D30);
    }

    function test_Stake_RevertsIfNotOwner() public {
        _setRarity(31, "Common");
        vm.prank(alice);
        vm.expectRevert(JuiceStaking.NotTokenOwner.selector);
        staking.stake(31, D30); // owned by bob
    }

    function test_Stake_RevertsIfAlreadyStaked() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D30);

        vm.prank(alice);
        vm.expectRevert(JuiceStaking.AlreadyStaked.selector);
        staking.stake(1, D30);
    }

    function test_Unstake_RevertsWhileLocked() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D30);

        vm.warp(block.timestamp + 29 days);
        vm.prank(alice);
        vm.expectRevert(JuiceStaking.StillLocked.selector);
        staking.unstake(1);
    }

    function test_Unstake_RevertsForNonOwner() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D30);

        vm.warp(block.timestamp + 30 days);
        vm.prank(bob);
        vm.expectRevert(JuiceStaking.NotStakeOwner.selector);
        staking.unstake(1);
    }

    function test_Unstake_ReturnsNftAndMintsRemainingRewards() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D30);

        vm.warp(block.timestamp + 30 days);
        vm.prank(alice);
        staking.unstake(1);

        assertEq(boys.ownerOf(1), alice);
        assertEq(juice.balanceOf(alice), 500e18);
    }

    function test_Unstake_AfterPartialClaimMintsOnlyRemainder() public {
        _setRarity(1, "Common");
        // See the comment in test_ExactPayout_SplitAcrossTwoClaims — warp
        // from a fixed local, not `block.timestamp`, to dodge the via-ir CSE
        // pitfall with two identical `+ 15 days` expressions in one function.
        uint256 t0 = block.timestamp;
        _stake(alice, 1, D30);

        vm.warp(t0 + 15 days);
        vm.prank(alice);
        staking.claimRewards(1);

        vm.warp(t0 + 30 days);
        vm.prank(alice);
        staking.unstake(1);

        assertEq(juice.balanceOf(alice), 500e18);
    }

    function test_Unstake_PastMaturityDoesNotOveraccrue() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D30);

        // Left sitting unclaimed well past the unlock time.
        vm.warp(block.timestamp + 90 days);
        vm.prank(alice);
        staking.unstake(1);

        assertEq(juice.balanceOf(alice), 500e18);
    }

    function test_StakeRemovedFromUserStakesAfterUnstake() public {
        _setRarity(1, "Common");
        _setRarity(2, "Common");
        _stake(alice, 1, D30);
        _stake(alice, 2, D30);

        vm.warp(block.timestamp + 30 days);
        vm.prank(alice);
        staking.unstake(1);

        uint256[] memory remaining = staking.getUserStakes(alice);
        assertEq(remaining.length, 1);
        assertEq(remaining[0], 2);
    }

    /* ═══════════════════════════ Emergency unstake ═══════════════════════════ */

    function test_EmergencyUnstake_ReturnsNftForfeitsRewards() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D30);

        vm.warp(block.timestamp + 15 days);
        vm.prank(alice);
        staking.emergencyUnstake(1);

        assertEq(boys.ownerOf(1), alice);
        assertEq(juice.balanceOf(alice), 0);
    }

    function test_EmergencyUnstake_WorksBeforeUnlock() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D365);

        // Barely staked, nowhere near unlock — regular unstake would revert.
        vm.warp(block.timestamp + 1 hours);
        vm.prank(alice);
        staking.emergencyUnstake(1);

        assertEq(boys.ownerOf(1), alice);
    }

    function test_EmergencyUnstake_RevertsForNonOwner() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D30);

        vm.prank(bob);
        vm.expectRevert(JuiceStaking.NotStakeOwner.selector);
        staking.emergencyUnstake(1);
    }

    /* ═══════════════════════════ Claim all ═══════════════════════════ */

    function test_ClaimAllRewards_AcrossMultipleStakes() public {
        _setRarity(1, "Common");
        _setRarity(2, "Legendary");
        _stake(alice, 1, D30);
        _stake(alice, 2, D30);

        vm.warp(block.timestamp + 30 days);
        vm.prank(alice);
        staking.claimAllRewards();

        // 500 (Common) + 1000 (Legendary 2x) = 1500
        assertEq(juice.balanceOf(alice), 1500e18);
    }

    function test_ClaimAllRewards_OnlyClaimsCallersStakes() public {
        _setRarity(1, "Common");
        _setRarity(31, "Common");
        _stake(alice, 1, D30);
        _stake(bob, 31, D30);

        vm.warp(block.timestamp + 30 days);
        vm.prank(alice);
        staking.claimAllRewards();

        assertEq(juice.balanceOf(alice), 500e18);
        assertEq(juice.balanceOf(bob), 0);
    }

    function test_ClaimAllRewards_RevertsWithNothingStaked() public {
        vm.prank(alice);
        vm.expectRevert(JuiceStaking.NotStaked.selector);
        staking.claimAllRewards();
    }

    function test_ClaimRewards_RevertsWithNothingToClaim() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D30);

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
        staking.stakeAll(ids, D30);

        assertEq(boys.ownerOf(1), address(staking));
        assertEq(boys.ownerOf(2), address(staking));
        assertEq(boys.ownerOf(3), address(staking));
        assertEq(staking.getUserStakes(alice).length, 3);
    }

    function test_StakeAll_RevertsOnEmptyBundle() public {
        uint256[] memory ids = new uint256[](0);
        vm.prank(alice);
        vm.expectRevert(JuiceStaking.BadBundle.selector);
        staking.stakeAll(ids, D30);
    }

    function test_StakeAll_RevertsOverMaxBatch() public {
        uint256 max = staking.MAX_BATCH();
        uint256[] memory ids = new uint256[](max + 1);
        vm.prank(alice);
        vm.expectRevert(JuiceStaking.BadBundle.selector);
        staking.stakeAll(ids, D30);
    }

    /* ═══════════════════════════ Fees ═══════════════════════════ */

    function test_Fees_DefaultToZero() public view {
        assertEq(staking.stakeFee(), 0);
        assertEq(staking.emergencyUnstakeFee(), 0);
    }

    function test_Fees_ZeroMeansStakingNeedsNoValue() public {
        _setRarity(1, "Common");
        vm.prank(alice);
        staking.stake(1, D30); // no ETH sent, should still work

        assertEq(boys.ownerOf(1), address(staking));
    }

    function test_Fees_StakeRevertsWhenUnderpaid() public {
        vm.prank(owner);
        staking.setFees(0.001 ether, 0);

        _setRarity(1, "Common");
        vm.prank(alice);
        vm.expectRevert(JuiceStaking.InsufficientFee.selector);
        staking.stake(1, D30);
    }

    function test_Fees_ForwardedToTreasury() public {
        vm.prank(owner);
        staking.setFees(0.001 ether, 0);

        _setRarity(1, "Common");
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        staking.stake{value: 0.001 ether}(1, D30);

        assertEq(treasury.balance, 0.001 ether);
    }

    function test_Fees_OnlyOwnerCanSet() public {
        vm.prank(alice);
        vm.expectRevert();
        staking.setFees(1 ether, 1 ether);
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

    function test_RarityChangeDoesNotAffectRunningStake() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D30);

        // Owner corrects the rarity after the stake is already running.
        _setRarity(1, "Mythic");

        vm.warp(block.timestamp + 30 days);
        vm.prank(alice);
        staking.claimRewards(1);

        // Still the Common total locked in at stake time, not Mythic.
        assertEq(juice.balanceOf(alice), 500e18);
    }

    /* ═══════════════════════════ Pause ═══════════════════════════ */

    function test_Pause_BlocksNewStakes() public {
        _setRarity(1, "Common");
        vm.prank(owner);
        staking.pause();

        vm.prank(alice);
        vm.expectRevert();
        staking.stake(1, D30);
    }

    function test_Pause_DoesNotTrapStakedNfts() public {
        _setRarity(1, "Common");
        _stake(alice, 1, D30);

        vm.prank(owner);
        staking.pause();

        vm.warp(block.timestamp + 30 days);
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
        blind.stake(staking, 100, D30);

        vm.warp(block.timestamp + 30 days);
        blind.unstake(staking, 100);

        assertEq(boys.ownerOf(100), address(blind));
    }

    /* ═══════════════════════════ Constructor ═══════════════════════════ */

    function test_Constructor_RevertsOnZeroAddress() public {
        vm.expectRevert(JuiceStaking.ZeroAddress.selector);
        new JuiceStaking(owner, address(0), address(juice), treasury);
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
