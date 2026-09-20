// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {BoyMeetsHoodLending} from "../contracts/BoyMeetsHoodLending.sol";

/* ───────────────────────────────── Mocks ────────────────────────────────── */

/// USDG stand-in: 6 decimals, with a freeze list like a real Paxos stablecoin.
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

    function _update(address from, address to, uint256 value) internal override {
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

    function fundRequest(BoyMeetsHoodLending lending, uint256 requestId)
        external
        returns (uint256)
    {
        return lending.fundRequest(requestId);
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

    uint128 internal constant PRINCIPAL = 25e6; // 25 USDG
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

        usdg.mint(lender, 100_000e6);
        usdg.mint(borrower, 100_000e6);

        // The borrower holds Boys 1..10
        for (uint256 i = 1; i <= 10; ++i) {
            boys.mint(borrower, i);
        }

        vm.prank(lender);
        usdg.approve(address(lending), type(uint256).max);
        vm.prank(borrower);
        usdg.approve(address(lending), type(uint256).max);
        vm.prank(borrower);
        boys.setApprovalForAll(address(lending), true);
    }

    /* ─────────────────────────── Helpers ──────────────────────────── */

    function _bundle(uint256 size) internal pure returns (uint256[] memory ids) {
        ids = new uint256[](size);
        for (uint256 i; i < size; ++i) {
            ids[i] = i + 1; // tokens 1..size
        }
    }

    function _postRequest(uint256 bundleSize) internal returns (uint256 id) {
        vm.prank(borrower);
        id = lending.createRequest(
            _bundle(bundleSize),
            PRINCIPAL,
            INTEREST,
            TERM,
            0
        );
    }

    function _postOffer(uint8 tokenCount) internal returns (uint256 id) {
        vm.prank(lender);
        id = lending.createOffer(PRINCIPAL, INTEREST, TERM, 0, tokenCount);
    }

    /* ══════════════════ The borrower-initiated path ═══════════════════ */

    function test_CreateRequest_NeedsNoUsdg() public {
        address broke = makeAddr("broke");
        boys.mint(broke, 100);

        vm.prank(broke);
        boys.setApprovalForAll(address(lending), true);

        uint256[] memory ids = new uint256[](1);
        ids[0] = 100;

        assertEq(usdg.balanceOf(broke), 0, "no USDG at all");

        vm.prank(broke);
        lending.createRequest(ids, PRINCIPAL, INTEREST, TERM, 0);

        assertEq(boys.ownerOf(100), address(lending), "Boy escrowed anyway");
    }

    function test_CreateRequest_EscrowsWholeBundle() public {
        uint256 requestId = _postRequest(5);

        for (uint256 i = 1; i <= 5; ++i) {
            assertEq(boys.ownerOf(i), address(lending));
        }
        assertEq(lending.requestTokens(requestId).length, 5);
    }

    function test_CancelRequest_ReturnsWholeBundle() public {
        uint256 requestId = _postRequest(5);

        vm.prank(borrower);
        lending.cancelRequest(requestId);

        for (uint256 i = 1; i <= 5; ++i) {
            assertEq(boys.ownerOf(i), borrower);
        }
    }

    function test_CancelRequest_OnlyBorrower() public {
        uint256 requestId = _postRequest(3);

        vm.prank(lender);
        vm.expectRevert(BoyMeetsHoodLending.NotOwnerOfPost.selector);
        lending.cancelRequest(requestId);
    }

    function test_FundRequest_PaysBorrowerAndStartsLoan() public {
        uint256 requestId = _postRequest(5);
        uint256 before = usdg.balanceOf(borrower);

        vm.prank(lender);
        uint256 loanId = lending.fundRequest(requestId);

        assertEq(usdg.balanceOf(borrower), before + PRINCIPAL, "borrower paid");
        assertEq(lending.loanTokens(loanId).length, 5, "bundle carried across");

        (, , uint128 principal, uint128 repayAmount, uint128 fee, , uint64 dueAt, ) =
            _loan(loanId);

        assertEq(principal, PRINCIPAL);
        assertEq(repayAmount, 27_500_000, "25 + 10%");
        assertEq(fee, 625_000, "2.5% of 25");
        assertEq(dueAt, block.timestamp + TERM);
    }

    function test_FundRequest_CannotFundOwnRequest() public {
        uint256 requestId = _postRequest(2);

        vm.prank(borrower);
        vm.expectRevert(BoyMeetsHoodLending.SelfDeal.selector);
        lending.fundRequest(requestId);
    }

    function test_FundRequest_CannotFundTwice() public {
        uint256 requestId = _postRequest(2);

        vm.prank(lender);
        lending.fundRequest(requestId);

        address second = makeAddr("second");
        usdg.mint(second, 1_000e6);
        vm.prank(second);
        usdg.approve(address(lending), type(uint256).max);

        vm.prank(second);
        vm.expectRevert(BoyMeetsHoodLending.Inactive.selector);
        lending.fundRequest(requestId);
    }

    function test_FundRequest_RevertsWhenExpired() public {
        vm.prank(borrower);
        uint256 requestId = lending.createRequest(
            _bundle(2),
            PRINCIPAL,
            INTEREST,
            TERM,
            uint64(block.timestamp + 1 hours)
        );

        vm.warp(block.timestamp + 2 hours);

        vm.prank(lender);
        vm.expectRevert(BoyMeetsHoodLending.Expired.selector);
        lending.fundRequest(requestId);
    }

    /* ══════════════════ The lender-initiated path ═════════════════════ */

    function test_CreateOffer_EscrowsPrincipal() public {
        uint256 before = usdg.balanceOf(lender);
        _postOffer(1);

        assertEq(usdg.balanceOf(lender), before - PRINCIPAL);
        assertEq(usdg.balanceOf(address(lending)), PRINCIPAL);
    }

    function test_TakeOffer_MovesBundleAndCash() public {
        uint256 offerId = _postOffer(3);
        uint256 before = usdg.balanceOf(borrower);

        vm.prank(borrower);
        uint256 loanId = lending.takeOffer(offerId, _bundle(3));

        for (uint256 i = 1; i <= 3; ++i) {
            assertEq(boys.ownerOf(i), address(lending));
        }
        assertEq(usdg.balanceOf(borrower), before + PRINCIPAL);
        assertEq(lending.loanTokens(loanId).length, 3);
    }

    function test_TakeOffer_EnforcesTokenCount() public {
        uint256 offerId = _postOffer(3);

        vm.prank(borrower);
        vm.expectRevert(BoyMeetsHoodLending.WrongTokenCount.selector);
        lending.takeOffer(offerId, _bundle(2));
    }

    function test_TakeOffer_CannotTakeOwnOffer() public {
        uint256 offerId = _postOffer(1);
        boys.mint(lender, 500);

        vm.prank(lender);
        boys.setApprovalForAll(address(lending), true);

        uint256[] memory ids = new uint256[](1);
        ids[0] = 500;

        vm.prank(lender);
        vm.expectRevert(BoyMeetsHoodLending.SelfDeal.selector);
        lending.takeOffer(offerId, ids);
    }

    function test_TakeOffer_RevertsWhenNotOwner() public {
        uint256 offerId = _postOffer(1);
        address stranger = makeAddr("stranger");

        uint256[] memory ids = new uint256[](1);
        ids[0] = 1; // owned by borrower, not stranger

        vm.prank(stranger);
        vm.expectRevert(BoyMeetsHoodLending.NotTokenOwner.selector);
        lending.takeOffer(offerId, ids);
    }

    function test_CancelOffer_CreditsLender() public {
        uint256 offerId = _postOffer(1);

        vm.prank(lender);
        lending.cancelOffer(offerId);
        assertEq(lending.owed(lender), PRINCIPAL);

        uint256 before = usdg.balanceOf(lender);
        vm.prank(lender);
        lending.withdraw();
        assertEq(usdg.balanceOf(lender), before + PRINCIPAL);
    }

    /* ═══════════════════════ Loan lifecycle ═══════════════════════════ */

    function test_Repay_ReleasesWholeBundle() public {
        uint256 requestId = _postRequest(5);
        vm.prank(lender);
        uint256 loanId = lending.fundRequest(requestId);

        vm.warp(block.timestamp + 6 days);
        vm.prank(borrower);
        lending.repay(loanId);

        for (uint256 i = 1; i <= 5; ++i) {
            assertEq(boys.ownerOf(i), borrower, "every Boy comes home");
        }
        assertEq(lending.owed(lender), 27_500_000);
        assertEq(lending.owed(treasury), 625_000);
    }

    function test_Repay_RevertsAfterDeadline() public {
        uint256 requestId = _postRequest(2);
        vm.prank(lender);
        uint256 loanId = lending.fundRequest(requestId);

        vm.warp(block.timestamp + TERM + 1);

        vm.prank(borrower);
        vm.expectRevert(BoyMeetsHoodLending.DeadlinePassed.selector);
        lending.repay(loanId);
    }

    function test_Repay_OnlyBorrower() public {
        uint256 requestId = _postRequest(2);
        vm.prank(lender);
        uint256 loanId = lending.fundRequest(requestId);

        vm.prank(lender);
        vm.expectRevert(BoyMeetsHoodLending.NotBorrower.selector);
        lending.repay(loanId);
    }

    function test_ClaimDefault_TransfersWholeBundleToLender() public {
        uint256 requestId = _postRequest(5);
        vm.prank(lender);
        uint256 loanId = lending.fundRequest(requestId);

        vm.warp(block.timestamp + TERM + 1);
        lending.claimDefault(loanId);

        for (uint256 i = 1; i <= 5; ++i) {
            assertEq(boys.ownerOf(i), lender, "lender takes the lot");
        }
    }

    function test_ClaimDefault_RevertsBeforeDeadline() public {
        uint256 requestId = _postRequest(2);
        vm.prank(lender);
        uint256 loanId = lending.fundRequest(requestId);

        vm.expectRevert(BoyMeetsHoodLending.DeadlineNotPassed.selector);
        lending.claimDefault(loanId);
    }

    function test_ClaimDefault_CannotClaimTwice() public {
        uint256 requestId = _postRequest(2);
        vm.prank(lender);
        uint256 loanId = lending.fundRequest(requestId);

        vm.warp(block.timestamp + TERM + 1);
        lending.claimDefault(loanId);

        vm.expectRevert(BoyMeetsHoodLending.LoanNotActive.selector);
        lending.claimDefault(loanId);
    }

    /* ═════════════ The two bugs that were fixed in v1 ═════════════════ */

    /// A frozen lender must not be able to block a borrower's repayment.
    function test_Repay_SucceedsWhenLenderIsFrozen() public {
        uint256 requestId = _postRequest(3);
        vm.prank(lender);
        uint256 loanId = lending.fundRequest(requestId);

        usdg.setFrozen(lender, true);

        vm.prank(borrower);
        lending.repay(loanId); // must not revert

        for (uint256 i = 1; i <= 3; ++i) {
            assertEq(boys.ownerOf(i), borrower);
        }
        assertEq(lending.owed(lender), 27_500_000, "credited, not pushed");

        usdg.setFrozen(lender, false);
        vm.prank(lender);
        lending.withdraw();
        assertEq(lending.owed(lender), 0);
    }

    /// A lender contract with no onERC721Received must still be able to claim.
    function test_ClaimDefault_WorksWhenLenderCannotReceiveNFT() public {
        BlindLender blind = new BlindLender();
        usdg.mint(address(blind), 1_000e6);
        blind.approve(usdg, address(lending), type(uint256).max);

        uint256 requestId = _postRequest(3);
        uint256 loanId = blind.fundRequest(lending, requestId);

        vm.warp(block.timestamp + TERM + 1);
        lending.claimDefault(loanId); // must not revert

        for (uint256 i = 1; i <= 3; ++i) {
            assertEq(boys.ownerOf(i), address(blind));
        }
    }

    /* ═══════════════════════ Bundle limits ════════════════════════════ */

    function test_Bundle_MaxSizeAccepted() public {
        for (uint256 i = 11; i <= 20; ++i) {
            boys.mint(borrower, i);
        }

        uint256[] memory ids = new uint256[](20);
        for (uint256 i; i < 20; ++i) ids[i] = i + 1;

        vm.prank(borrower);
        uint256 requestId = lending.createRequest(ids, PRINCIPAL, INTEREST, TERM, 0);

        vm.prank(lender);
        uint256 loanId = lending.fundRequest(requestId);

        vm.prank(borrower);
        lending.repay(loanId);

        for (uint256 i = 1; i <= 20; ++i) {
            assertEq(boys.ownerOf(i), borrower);
        }
    }

    function test_Bundle_OverMaxRejected() public {
        uint256[] memory ids = new uint256[](21);
        for (uint256 i; i < 21; ++i) ids[i] = i + 1;

        vm.prank(borrower);
        vm.expectRevert(BoyMeetsHoodLending.BadBundle.selector);
        lending.createRequest(ids, PRINCIPAL, INTEREST, TERM, 0);
    }

    function test_Bundle_EmptyRejected() public {
        uint256[] memory ids = new uint256[](0);

        vm.prank(borrower);
        vm.expectRevert(BoyMeetsHoodLending.BadBundle.selector);
        lending.createRequest(ids, PRINCIPAL, INTEREST, TERM, 0);
    }

    /* ═════════════════════════════ Fees ═══════════════════════════════ */

    function test_Fee_SnapshotAtLoanStart() public {
        uint256 requestId = _postRequest(2);
        vm.prank(lender);
        uint256 loanId = lending.fundRequest(requestId);

        vm.prank(owner);
        lending.setFeeBps(500);

        assertEq(lending.totalDue(loanId), 28_125_000, "unchanged by later fee");
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

    /* ═══════════════════════════ Pausing ══════════════════════════════ */

    function test_Pause_BlocksNewPosts() public {
        vm.prank(owner);
        lending.pause();

        vm.prank(borrower);
        vm.expectRevert();
        lending.createRequest(_bundle(1), PRINCIPAL, INTEREST, TERM, 0);
    }

    function test_Pause_DoesNotTrapCollateral() public {
        uint256 requestId = _postRequest(3);
        vm.prank(lender);
        uint256 loanId = lending.fundRequest(requestId);

        vm.prank(owner);
        lending.pause();

        vm.prank(borrower);
        lending.repay(loanId);

        for (uint256 i = 1; i <= 3; ++i) {
            assertEq(boys.ownerOf(i), borrower);
        }

        vm.prank(lender);
        lending.withdraw();
    }

    function test_Pause_AllowsCancel() public {
        uint256 requestId = _postRequest(2);

        vm.prank(owner);
        lending.pause();

        vm.prank(borrower);
        lending.cancelRequest(requestId);
        assertEq(boys.ownerOf(1), borrower);
    }

    /* ═══════════════════════════ Validation ═══════════════════════════ */

    function test_CreateRequest_RevertsOnZeroPrincipal() public {
        vm.prank(borrower);
        vm.expectRevert(BoyMeetsHoodLending.ZeroPrincipal.selector);
        lending.createRequest(_bundle(1), 0, INTEREST, TERM, 0);
    }

    function test_CreateRequest_RevertsOnShortDuration() public {
        vm.prank(borrower);
        vm.expectRevert(BoyMeetsHoodLending.BadDuration.selector);
        lending.createRequest(_bundle(1), PRINCIPAL, INTEREST, 1 minutes, 0);
    }

    function test_CreateRequest_RevertsWhenNotOwner() public {
        address stranger = makeAddr("stranger");

        vm.prank(stranger);
        vm.expectRevert(BoyMeetsHoodLending.NotTokenOwner.selector);
        lending.createRequest(_bundle(1), PRINCIPAL, INTEREST, TERM, 0);
    }

    function test_Withdraw_RevertsWhenNothingOwed() public {
        vm.prank(lender);
        vm.expectRevert(BoyMeetsHoodLending.NothingOwed.selector);
        lending.withdraw();
    }

    /* ═══════════════════════════ Fuzzing ══════════════════════════════ */

    function testFuzz_AnyAmountAndRate(uint128 principal, uint16 interestBps)
        public
    {
        principal = uint128(bound(principal, 1, 1_000_000e6));
        interestBps = uint16(bound(interestBps, 0, 10_000));

        usdg.mint(lender, principal);

        vm.prank(borrower);
        uint256 requestId = lending.createRequest(
            _bundle(3),
            principal,
            interestBps,
            TERM,
            0
        );

        vm.prank(lender);
        uint256 loanId = lending.fundRequest(requestId);

        (, , , uint128 repayAmount, , , , ) = _loan(loanId);
        uint256 expected =
            uint256(principal) + (uint256(principal) * interestBps) / 10_000;

        assertEq(repayAmount, expected);
        assertGe(repayAmount, principal, "never repay less than borrowed");
    }

    /**
     * The contract must always hold at least what it owes, plus every escrowed
     * offer. If this fails, someone can be shortchanged.
     */
    function test_Solvency_AfterMixedActivity() public {
        uint256 requestId = _postRequest(3);
        vm.prank(lender);
        uint256 loanId = lending.fundRequest(requestId);

        _postOffer(1); // untaken, still escrowed

        vm.prank(borrower);
        lending.repay(loanId);

        uint256 liabilities =
            lending.owed(lender) + lending.owed(treasury) + PRINCIPAL;

        assertGe(usdg.balanceOf(address(lending)), liabilities);
    }

    /* ───────────────────────────── Internals ──────────────────────────── */

    function _loan(uint256 loanId)
        internal
        view
        returns (
            address,
            address,
            uint128,
            uint128,
            uint128,
            uint64,
            uint64,
            BoyMeetsHoodLending.Status
        )
    {
        return lending.loans(loanId);
    }
}
