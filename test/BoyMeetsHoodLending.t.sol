// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {BoyMeetsHoodLending} from "../contracts/BoyMeetsHoodLending.sol";

/* ───────────────────────────────── Mocks ────────────────────────────────── */

/// USDG stand-in: 6 decimals, and a freeze list like a real Paxos stablecoin.
contract MockUSDG is ERC20 {
    mapping(address => bool) public frozen;

    constructor() ERC20("Global Dollar", "USDG") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setFrozen(address account, bool value) external {
        frozen[account] = value;
    }

    function _update(address from, address to, uint256 value)
        internal
        override
    {
        require(!frozen[from] && !frozen[to], "USDG: frozen");
        super._update(from, to, value);
    }
}

contract MockBoys is ERC721 {
    constructor() ERC721("BoyMeetsHood", "BOY") {}

    function mint(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }
}

/// A lender that is a contract and cannot receive ERC-721 safely.
contract BlindLender {
    function approve(MockUSDG token, address spender, uint256 amount) external {
        token.approve(spender, amount);
    }

    function createOffer(
        BoyMeetsHoodLending lending,
        uint128 principal,
        uint16 interestBps,
        uint32 duration
    ) external returns (uint256) {
        return
            lending.createOffer(
                principal,
                interestBps,
                duration,
                0,
                BoyMeetsHoodLending.Collateral.Any,
                0
            );
    }
}

/* ───────────────────────────────── Tests ────────────────────────────────── */

contract BoyMeetsHoodLendingTest is Test {
    BoyMeetsHoodLending internal lending;
    MockUSDG internal usdg;
    MockBoys internal boys;

    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");
    address internal lender = makeAddr("lender");
    address internal borrower = makeAddr("borrower");

    uint128 internal constant PRINCIPAL = 400e6; // 400 USDG
    uint16 internal constant INTEREST = 1000; // 10%
    uint32 internal constant TERM = 7 days;
    uint16 internal constant FEE = 250; // 2.5%

    function setUp() public {
        usdg = new MockUSDG();
        boys = new MockBoys();

        lending = new BoyMeetsHoodLending(
            address(boys),
            address(usdg),
            treasury,
            FEE,
            owner
        );

        usdg.mint(lender, 10_000e6);
        usdg.mint(borrower, 10_000e6);
        boys.mint(borrower, 1204);

        vm.prank(lender);
        usdg.approve(address(lending), type(uint256).max);
        vm.prank(borrower);
        usdg.approve(address(lending), type(uint256).max);
        vm.prank(borrower);
        boys.setApprovalForAll(address(lending), true);
    }

    /* ─────────────────────────── Helpers ──────────────────────────── */

    function _postOffer() internal returns (uint256 offerId) {
        vm.prank(lender);
        offerId = lending.createOffer(
            PRINCIPAL,
            INTEREST,
            TERM,
            0,
            BoyMeetsHoodLending.Collateral.Any,
            0
        );
    }

    function _startLoan() internal returns (uint256 loanId) {
        uint256 offerId = _postOffer();
        vm.prank(borrower);
        loanId = lending.takeOffer(offerId, 1204);
    }

    /* ───────────────────────── Offer lifecycle ────────────────────── */

    function test_CreateOffer_EscrowsPrincipal() public {
        uint256 before = usdg.balanceOf(lender);
        _postOffer();

        assertEq(usdg.balanceOf(lender), before - PRINCIPAL);
        assertEq(usdg.balanceOf(address(lending)), PRINCIPAL);
    }

    function test_CancelOffer_CreditsLender() public {
        uint256 offerId = _postOffer();

        vm.prank(lender);
        lending.cancelOffer(offerId);

        assertEq(lending.owed(lender), PRINCIPAL);

        uint256 before = usdg.balanceOf(lender);
        vm.prank(lender);
        lending.withdraw();
        assertEq(usdg.balanceOf(lender), before + PRINCIPAL);
    }

    function test_CancelOffer_OnlyLender() public {
        uint256 offerId = _postOffer();

        vm.prank(borrower);
        vm.expectRevert(BoyMeetsHoodLending.NotOfferLender.selector);
        lending.cancelOffer(offerId);
    }

    function test_TakeOffer_RevertsOnCancelled() public {
        uint256 offerId = _postOffer();
        vm.prank(lender);
        lending.cancelOffer(offerId);

        vm.prank(borrower);
        vm.expectRevert(BoyMeetsHoodLending.OfferInactive.selector);
        lending.takeOffer(offerId, 1204);
    }

    function test_TakeOffer_RevertsWhenExpired() public {
        vm.prank(lender);
        uint256 offerId = lending.createOffer(
            PRINCIPAL,
            INTEREST,
            TERM,
            uint64(block.timestamp + 1 hours),
            BoyMeetsHoodLending.Collateral.Any,
            0
        );

        vm.warp(block.timestamp + 2 hours);

        vm.prank(borrower);
        vm.expectRevert(BoyMeetsHoodLending.OfferExpired.selector);
        lending.takeOffer(offerId, 1204);
    }

    function test_TakeOffer_RevertsOnSelfBorrow() public {
        uint256 offerId = _postOffer();
        boys.mint(lender, 999);

        vm.prank(lender);
        boys.setApprovalForAll(address(lending), true);
        vm.prank(lender);
        vm.expectRevert(BoyMeetsHoodLending.SelfBorrow.selector);
        lending.takeOffer(offerId, 999);
    }

    function test_TakeOffer_RevertsWhenNotOwner() public {
        uint256 offerId = _postOffer();
        address stranger = makeAddr("stranger");

        vm.prank(stranger);
        vm.expectRevert(BoyMeetsHoodLending.NotTokenOwner.selector);
        lending.takeOffer(offerId, 1204);
    }

    function test_TakeOffer_SpecificCollateralEnforced() public {
        vm.prank(lender);
        uint256 offerId = lending.createOffer(
            PRINCIPAL,
            INTEREST,
            TERM,
            0,
            BoyMeetsHoodLending.Collateral.Specific,
            88
        );

        vm.prank(borrower);
        vm.expectRevert(BoyMeetsHoodLending.TokenNotEligible.selector);
        lending.takeOffer(offerId, 1204);
    }

    /* ──────────────────────────── Loan flow ───────────────────────── */

    function test_TakeOffer_MovesAssets() public {
        uint256 before = usdg.balanceOf(borrower);
        uint256 loanId = _startLoan();

        assertEq(boys.ownerOf(1204), address(lending), "NFT should be escrowed");
        assertEq(usdg.balanceOf(borrower), before + PRINCIPAL);

        (, , , uint128 principal, uint128 repayAmount, uint128 fee, , uint64 dueAt, ) =
            lending.loans(loanId);

        assertEq(principal, PRINCIPAL);
        assertEq(repayAmount, 440e6, "400 + 10%");
        assertEq(fee, 10e6, "2.5% of 400");
        assertEq(dueAt, block.timestamp + TERM);
    }

    function test_Repay_ReleasesCollateralAndCredits() public {
        uint256 loanId = _startLoan();
        uint256 due = lending.totalDue(loanId);
        assertEq(due, 450e6, "440 repay + 10 fee");

        vm.warp(block.timestamp + 6 days);
        vm.prank(borrower);
        lending.repay(loanId);

        assertEq(boys.ownerOf(1204), borrower, "Boy should come home");
        assertEq(lending.owed(lender), 440e6);
        assertEq(lending.owed(treasury), 10e6);
    }

    function test_Repay_RevertsAfterDeadline() public {
        uint256 loanId = _startLoan();
        vm.warp(block.timestamp + TERM + 1);

        vm.prank(borrower);
        vm.expectRevert(BoyMeetsHoodLending.DeadlinePassed.selector);
        lending.repay(loanId);
    }

    function test_Repay_OnlyBorrower() public {
        uint256 loanId = _startLoan();

        vm.prank(lender);
        vm.expectRevert(BoyMeetsHoodLending.NotBorrower.selector);
        lending.repay(loanId);
    }

    function test_Repay_CannotRepayTwice() public {
        uint256 loanId = _startLoan();
        vm.prank(borrower);
        lending.repay(loanId);

        vm.prank(borrower);
        vm.expectRevert(BoyMeetsHoodLending.LoanNotActive.selector);
        lending.repay(loanId);
    }

    function test_ClaimDefault_RevertsBeforeDeadline() public {
        uint256 loanId = _startLoan();

        vm.expectRevert(BoyMeetsHoodLending.DeadlineNotPassed.selector);
        lending.claimDefault(loanId);
    }

    function test_ClaimDefault_TransfersToLender() public {
        uint256 loanId = _startLoan();
        vm.warp(block.timestamp + TERM + 1);

        lending.claimDefault(loanId);

        assertEq(boys.ownerOf(1204), lender);
    }

    function test_ClaimDefault_CannotClaimTwice() public {
        uint256 loanId = _startLoan();
        vm.warp(block.timestamp + TERM + 1);
        lending.claimDefault(loanId);

        vm.expectRevert(BoyMeetsHoodLending.LoanNotActive.selector);
        lending.claimDefault(loanId);
    }

    /* ─────────────────── The two bugs that were fixed ─────────────── */

    /**
     * BUG 1: with a push payment, a frozen lender address would make repay()
     * revert and cost the borrower their collateral on a loan they were
     * actively trying to settle.
     */
    function test_Repay_SucceedsWhenLenderIsFrozen() public {
        uint256 loanId = _startLoan();

        usdg.setFrozen(lender, true);

        vm.prank(borrower);
        lending.repay(loanId); // must not revert

        assertEq(boys.ownerOf(1204), borrower, "borrower keeps their Boy");
        assertEq(lending.owed(lender), 440e6, "credited, not pushed");

        // The frozen lender blocks only themselves.
        vm.prank(lender);
        vm.expectRevert();
        lending.withdraw();

        // And can collect once unfrozen.
        usdg.setFrozen(lender, false);
        vm.prank(lender);
        lending.withdraw();
        assertEq(lending.owed(lender), 0);
    }

    /**
     * BUG 2: with safeTransferFrom, a lender contract without
     * onERC721Received would make claimDefault() revert forever, stranding
     * the NFT in escrow permanently.
     */
    function test_ClaimDefault_WorksWhenLenderCannotReceiveNFT() public {
        BlindLender blind = new BlindLender();
        usdg.mint(address(blind), 1_000e6);
        blind.approve(usdg, address(lending), type(uint256).max);

        uint256 offerId = blind.createOffer(lending, PRINCIPAL, INTEREST, TERM);

        vm.prank(borrower);
        uint256 loanId = lending.takeOffer(offerId, 1204);

        vm.warp(block.timestamp + TERM + 1);
        lending.claimDefault(loanId); // must not revert

        assertEq(boys.ownerOf(1204), address(blind));
    }

    /* ────────────────────────────── Fees ──────────────────────────── */

    function test_Fee_SnapshotAtTakeOffer() public {
        uint256 loanId = _startLoan();

        // Owner raises the fee after the loan started.
        vm.prank(owner);
        lending.setFeeBps(500);

        assertEq(lending.totalDue(loanId), 450e6, "existing loan unchanged");
    }

    function test_Fee_CannotExceedCap() public {
        vm.prank(owner);
        vm.expectRevert(BoyMeetsHoodLending.BadFee.selector);
        lending.setFeeBps(501);
    }

    function test_Fee_OnlyOwner() public {
        vm.prank(lender);
        vm.expectRevert();
        lending.setFeeBps(100);
    }

    function test_Fee_ZeroMeansNoFee() public {
        vm.prank(owner);
        lending.setFeeBps(0);

        uint256 loanId = _startLoan();
        assertEq(lending.totalDue(loanId), 440e6);

        vm.prank(borrower);
        lending.repay(loanId);
        assertEq(lending.owed(treasury), 0);
    }

    /* ───────────────────────────── Pausing ────────────────────────── */

    function test_Pause_BlocksNewOffers() public {
        vm.prank(owner);
        lending.pause();

        vm.prank(lender);
        vm.expectRevert();
        lending.createOffer(
            PRINCIPAL,
            INTEREST,
            TERM,
            0,
            BoyMeetsHoodLending.Collateral.Any,
            0
        );
    }

    function test_Pause_DoesNotTrapCollateral() public {
        uint256 loanId = _startLoan();

        vm.prank(owner);
        lending.pause();

        // Repayment still works while paused.
        vm.prank(borrower);
        lending.repay(loanId);
        assertEq(boys.ownerOf(1204), borrower);

        // And so does withdrawal.
        vm.prank(lender);
        lending.withdraw();
    }

    /* ───────────────────────── Validation ─────────────────────────── */

    function test_CreateOffer_RevertsOnZeroPrincipal() public {
        vm.prank(lender);
        vm.expectRevert(BoyMeetsHoodLending.ZeroPrincipal.selector);
        lending.createOffer(0, INTEREST, TERM, 0, BoyMeetsHoodLending.Collateral.Any, 0);
    }

    function test_CreateOffer_RevertsOnShortDuration() public {
        vm.prank(lender);
        vm.expectRevert(BoyMeetsHoodLending.BadDuration.selector);
        lending.createOffer(
            PRINCIPAL,
            INTEREST,
            1 minutes,
            0,
            BoyMeetsHoodLending.Collateral.Any,
            0
        );
    }

    function test_Withdraw_RevertsWhenNothingOwed() public {
        vm.prank(lender);
        vm.expectRevert(BoyMeetsHoodLending.NothingOwed.selector);
        lending.withdraw();
    }

    /* ───────────────────────────── Fuzzing ────────────────────────── */

    function testFuzz_InterestMath(uint128 principal, uint16 interestBps) public {
        principal = uint128(bound(principal, 1e6, 1_000_000e6));
        interestBps = uint16(bound(interestBps, 0, 10_000));

        usdg.mint(lender, principal);

        vm.prank(lender);
        uint256 offerId = lending.createOffer(
            principal,
            interestBps,
            TERM,
            0,
            BoyMeetsHoodLending.Collateral.Any,
            0
        );

        vm.prank(borrower);
        uint256 loanId = lending.takeOffer(offerId, 1204);

        (, , , , uint128 repayAmount, , , , ) = lending.loans(loanId);
        uint256 expected =
            uint256(principal) + (uint256(principal) * interestBps) / 10_000;

        assertEq(repayAmount, expected);
        assertGe(repayAmount, principal, "never repay less than borrowed");
    }

    /**
     * The contract must always hold at least what it owes people, plus every
     * escrowed offer. If this ever fails, someone can be shortchanged.
     */
    function test_Solvency_AfterFullCycle() public {
        uint256 loanId = _startLoan();
        _postOffer(); // a second, untaken offer still escrowed

        vm.prank(borrower);
        lending.repay(loanId);

        uint256 liabilities =
            lending.owed(lender) + lending.owed(treasury) + PRINCIPAL;

        assertGe(
            usdg.balanceOf(address(lending)),
            liabilities,
            "contract must cover what it owes"
        );
    }
}
