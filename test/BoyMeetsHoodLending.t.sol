// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {BoyMeetsHoodLending} from "../contracts/BoyMeetsHoodLending.sol";

/* ───────────────────────────────── Mocks ────────────────────────────────── */

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

/// A borrower contract with no receive() — native sends to it always fail.
contract RejectingBorrower {
    function approveBoys(MockBoys boys, address operator) external {
        boys.setApprovalForAll(operator, true);
    }

    function createRequest(
        BoyMeetsHoodLending lending,
        uint256[] calldata tokenIds,
        uint128 principal,
        uint16 interestBps,
        uint32 duration
    ) external returns (uint256) {
        return
            lending.createRequest(
                tokenIds,
                principal,
                interestBps,
                duration,
                0,
                BoyMeetsHoodLending.Currency.ETH
            );
    }

    function onERC721Received(address, address, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return this.onERC721Received.selector;
    }
}

/// A lender contract that cannot receive ERC-721 safely.
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

    uint128 internal constant USDG_AMOUNT = 25e6; // 25 USDG
    uint128 internal constant ETH_AMOUNT = 0.1 ether;
    uint16 internal constant INTEREST = 1000; // 10%
    uint32 internal constant TERM = 7 days;
    uint16 internal constant FEE = 250; // 2.5%

    BoyMeetsHoodLending.Currency internal constant USD =
        BoyMeetsHoodLending.Currency.USDG;
    BoyMeetsHoodLending.Currency internal constant ETH =
        BoyMeetsHoodLending.Currency.ETH;

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
        vm.deal(lender, 100 ether);
        vm.deal(borrower, 100 ether);

        for (uint256 i = 1; i <= 25; ++i) {
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
        for (uint256 i; i < size; ++i) ids[i] = i + 1;
    }

    function _request(
        uint256 bundleSize,
        uint128 principal,
        BoyMeetsHoodLending.Currency currency
    ) internal returns (uint256 id) {
        vm.prank(borrower);
        id = lending.createRequest(
            _bundle(bundleSize),
            principal,
            INTEREST,
            TERM,
            0,
            currency
        );
    }

    function _loanStatus(uint256 loanId)
        internal
        view
        returns (BoyMeetsHoodLending.Status status)
    {
        (, , , , , , , , status) = lending.loans(loanId);
    }

    /* ══════════════════════════ USDG loans ════════════════════════════ */

    function test_Usdg_RequestFundRepay() public {
        uint256 requestId = _request(5, USDG_AMOUNT, USD);
        uint256 before = usdg.balanceOf(borrower);

        vm.prank(lender);
        uint256 loanId = lending.fundRequest(requestId);
        assertEq(usdg.balanceOf(borrower), before + USDG_AMOUNT);

        vm.prank(borrower);
        lending.repay(loanId);

        for (uint256 i = 1; i <= 5; ++i) assertEq(boys.ownerOf(i), borrower);
        assertEq(lending.owedUsdg(lender), 27_500_000);
        assertEq(lending.owedUsdg(treasury), 625_000);

        uint256 lenderBefore = usdg.balanceOf(lender);
        vm.prank(lender);
        lending.withdraw(USD);
        assertEq(usdg.balanceOf(lender), lenderBefore + 27_500_000);
    }

    function test_Usdg_RejectsStrayValue() public {
        uint256 requestId = _request(2, USDG_AMOUNT, USD);

        vm.prank(lender);
        vm.expectRevert(BoyMeetsHoodLending.BadValue.selector);
        lending.fundRequest{value: 1 ether}(requestId);
    }

    /* ═══════════════════════════ ETH loans ════════════════════════════ */

    function test_Eth_RequestFundRepay() public {
        uint256 requestId = _request(3, ETH_AMOUNT, ETH);
        uint256 before = borrower.balance;

        vm.prank(lender);
        uint256 loanId = lending.fundRequest{value: ETH_AMOUNT}(requestId);
        assertEq(borrower.balance, before + ETH_AMOUNT, "borrower paid in ETH");

        uint256 due = lending.totalDue(loanId);
        assertEq(due, 0.1125 ether, "0.1 + 10% + 2.5% fee");

        vm.prank(borrower);
        lending.repay{value: due}(loanId);

        for (uint256 i = 1; i <= 3; ++i) assertEq(boys.ownerOf(i), borrower);
        assertEq(lending.owedEth(lender), 0.11 ether);
        assertEq(lending.owedEth(treasury), 0.0025 ether);

        uint256 lenderBefore = lender.balance;
        vm.prank(lender);
        lending.withdraw(ETH);
        assertEq(lender.balance, lenderBefore + 0.11 ether);
    }

    /// Denomination, not value: repay the same ETH regardless of price moves.
    function test_Eth_RepaymentIsDenominatedNotPegged() public {
        uint256 requestId = _request(2, ETH_AMOUNT, ETH);

        vm.prank(lender);
        uint256 loanId = lending.fundRequest{value: ETH_AMOUNT}(requestId);

        // Whatever happens off-chain, the amount owed is fixed in ETH.
        assertEq(lending.totalDue(loanId), 0.1125 ether);

        vm.warp(block.timestamp + 6 days);
        assertEq(lending.totalDue(loanId), 0.1125 ether, "unchanged over time");
    }

    function test_Eth_FundRequestRejectsWrongValue() public {
        uint256 requestId = _request(2, ETH_AMOUNT, ETH);

        vm.prank(lender);
        vm.expectRevert(BoyMeetsHoodLending.BadValue.selector);
        lending.fundRequest{value: 0.05 ether}(requestId);

        vm.prank(lender);
        vm.expectRevert(BoyMeetsHoodLending.BadValue.selector);
        lending.fundRequest{value: 0.2 ether}(requestId);
    }

    function test_Eth_RepayRejectsWrongValue() public {
        uint256 requestId = _request(2, ETH_AMOUNT, ETH);
        vm.prank(lender);
        uint256 loanId = lending.fundRequest{value: ETH_AMOUNT}(requestId);

        vm.prank(borrower);
        vm.expectRevert(BoyMeetsHoodLending.BadValue.selector);
        lending.repay{value: 0.11 ether}(loanId);
    }

    function test_Eth_OfferAndTake() public {
        vm.prank(lender);
        uint256 offerId = lending.createOffer{value: ETH_AMOUNT}(
            ETH_AMOUNT,
            INTEREST,
            TERM,
            0,
            3,
            ETH
        );

        uint256 before = borrower.balance;
        vm.prank(borrower);
        uint256 loanId = lending.takeOffer(offerId, _bundle(3));

        assertEq(borrower.balance, before + ETH_AMOUNT);
        assertEq(uint8(_loanStatus(loanId)), 1, "active");
    }

    function test_Eth_CancelOfferCredits() public {
        vm.prank(lender);
        uint256 offerId = lending.createOffer{value: ETH_AMOUNT}(
            ETH_AMOUNT,
            INTEREST,
            TERM,
            0,
            1,
            ETH
        );

        vm.prank(lender);
        lending.cancelOffer(offerId);
        assertEq(lending.owedEth(lender), ETH_AMOUNT);

        uint256 before = lender.balance;
        vm.prank(lender);
        lending.withdraw(ETH);
        assertEq(lender.balance, before + ETH_AMOUNT);
    }

    /**
     * A borrower that can't receive ETH must not make the lender's funding
     * transaction revert. The amount is credited for them to pull instead.
     */
    function test_Eth_PayoutFallsBackToCreditWhenBorrowerRejects() public {
        RejectingBorrower rb = new RejectingBorrower();
        boys.mint(address(rb), 500);
        rb.approveBoys(boys, address(lending));

        uint256[] memory ids = new uint256[](1);
        ids[0] = 500;

        uint256 requestId = rb.createRequest(
            lending,
            ids,
            ETH_AMOUNT,
            INTEREST,
            TERM
        );

        vm.prank(lender);
        lending.fundRequest{value: ETH_AMOUNT}(requestId); // must not revert

        assertEq(address(rb).balance, 0, "direct send failed");
        assertEq(lending.owedEth(address(rb)), ETH_AMOUNT, "credited instead");
    }

    /* ═════════════ Both currencies side by side ══════════════════════ */

    function test_BothCurrencies_CoexistOnTheBook() public {
        uint256 usdgRequest = _request(2, USDG_AMOUNT, USD);

        vm.prank(borrower);
        uint256[] memory second = new uint256[](2);
        second[0] = 10;
        second[1] = 11;
        vm.prank(borrower);
        uint256 ethRequest = lending.createRequest(
            second,
            ETH_AMOUNT,
            INTEREST,
            TERM,
            0,
            ETH
        );

        vm.prank(lender);
        lending.fundRequest(usdgRequest);
        vm.prank(lender);
        lending.fundRequest{value: ETH_AMOUNT}(ethRequest);

        vm.prank(borrower);
        lending.repay(1);
        vm.prank(borrower);
        lending.repay{value: lending.totalDue(2)}(2);

        assertEq(lending.owedUsdg(lender), 27_500_000);
        assertEq(lending.owedEth(lender), 0.11 ether);
    }

    function test_Withdraw_RevertsWhenNothingOwedInThatCurrency() public {
        uint256 requestId = _request(2, USDG_AMOUNT, USD);
        vm.prank(lender);
        uint256 loanId = lending.fundRequest(requestId);
        vm.prank(borrower);
        lending.repay(loanId);

        // Owed in USDG, nothing in ETH.
        vm.prank(lender);
        vm.expectRevert(BoyMeetsHoodLending.NothingOwed.selector);
        lending.withdraw(ETH);
    }

    /* ═════════════════ Carried over from v2 ═══════════════════════════ */

    function test_CreateRequest_NeedsNoCapital() public {
        address broke = makeAddr("broke");
        boys.mint(broke, 600);
        vm.prank(broke);
        boys.setApprovalForAll(address(lending), true);

        uint256[] memory ids = new uint256[](1);
        ids[0] = 600;

        assertEq(usdg.balanceOf(broke), 0);
        assertEq(broke.balance, 0);

        vm.prank(broke);
        lending.createRequest(ids, ETH_AMOUNT, INTEREST, TERM, 0, ETH);

        assertEq(boys.ownerOf(600), address(lending));
    }

    function test_CancelRequest_ReturnsWholeBundle() public {
        uint256 requestId = _request(5, USDG_AMOUNT, USD);

        vm.prank(borrower);
        lending.cancelRequest(requestId);

        for (uint256 i = 1; i <= 5; ++i) assertEq(boys.ownerOf(i), borrower);
    }

    function test_FundRequest_CannotFundOwn() public {
        uint256 requestId = _request(2, USDG_AMOUNT, USD);

        vm.prank(borrower);
        vm.expectRevert(BoyMeetsHoodLending.SelfDeal.selector);
        lending.fundRequest(requestId);
    }

    function test_Repay_RevertsAfterDeadline() public {
        uint256 requestId = _request(2, USDG_AMOUNT, USD);
        vm.prank(lender);
        uint256 loanId = lending.fundRequest(requestId);

        vm.warp(block.timestamp + TERM + 1);
        vm.prank(borrower);
        vm.expectRevert(BoyMeetsHoodLending.DeadlinePassed.selector);
        lending.repay(loanId);
    }

    function test_ClaimDefault_TransfersWholeBundle() public {
        uint256 requestId = _request(5, ETH_AMOUNT, ETH);
        vm.prank(lender);
        uint256 loanId = lending.fundRequest{value: ETH_AMOUNT}(requestId);

        vm.warp(block.timestamp + TERM + 1);
        lending.claimDefault(loanId);

        for (uint256 i = 1; i <= 5; ++i) assertEq(boys.ownerOf(i), lender);
    }

    function test_Repay_SucceedsWhenLenderIsFrozen() public {
        uint256 requestId = _request(3, USDG_AMOUNT, USD);
        vm.prank(lender);
        uint256 loanId = lending.fundRequest(requestId);

        usdg.setFrozen(lender, true);

        vm.prank(borrower);
        lending.repay(loanId); // must not revert

        for (uint256 i = 1; i <= 3; ++i) assertEq(boys.ownerOf(i), borrower);
        assertEq(lending.owedUsdg(lender), 27_500_000);
    }

    function test_ClaimDefault_WorksWhenLenderCannotReceiveNFT() public {
        BlindLender blind = new BlindLender();
        usdg.mint(address(blind), 1_000e6);
        blind.approve(usdg, address(lending), type(uint256).max);

        uint256 requestId = _request(3, USDG_AMOUNT, USD);
        uint256 loanId = blind.fundRequest(lending, requestId);

        vm.warp(block.timestamp + TERM + 1);
        lending.claimDefault(loanId);

        for (uint256 i = 1; i <= 3; ++i) assertEq(boys.ownerOf(i), address(blind));
    }

    /* ═══════════════════════ Bundles and limits ═══════════════════════ */

    function test_Bundle_MaxSizeAccepted() public {
        uint256[] memory ids = new uint256[](20);
        for (uint256 i; i < 20; ++i) ids[i] = i + 1;

        vm.prank(borrower);
        uint256 requestId = lending.createRequest(
            ids,
            ETH_AMOUNT,
            INTEREST,
            TERM,
            0,
            ETH
        );

        vm.prank(lender);
        uint256 loanId = lending.fundRequest{value: ETH_AMOUNT}(requestId);

        vm.prank(borrower);
        lending.repay{value: lending.totalDue(loanId)}(loanId);

        for (uint256 i = 1; i <= 20; ++i) assertEq(boys.ownerOf(i), borrower);
    }

    function test_Bundle_OverMaxRejected() public {
        uint256[] memory ids = new uint256[](21);
        for (uint256 i; i < 21; ++i) ids[i] = i + 1;

        vm.prank(borrower);
        vm.expectRevert(BoyMeetsHoodLending.BadBundle.selector);
        lending.createRequest(ids, USDG_AMOUNT, INTEREST, TERM, 0, USD);
    }

    /* ════════════════════════════ Fees ═══════════════════════════════ */

    function test_Fee_SnapshotAtLoanStart() public {
        uint256 requestId = _request(2, USDG_AMOUNT, USD);
        vm.prank(lender);
        uint256 loanId = lending.fundRequest(requestId);

        vm.prank(owner);
        lending.setFeeBps(500);

        assertEq(lending.totalDue(loanId), 28_125_000);
    }

    function test_Fee_CannotExceedCap() public {
        vm.prank(owner);
        vm.expectRevert(BoyMeetsHoodLending.BadFee.selector);
        lending.setFeeBps(501);
    }

    /* ═══════════════════════════ Pausing ═════════════════════════════ */

    function test_Pause_DoesNotTrapCollateral() public {
        uint256 requestId = _request(3, ETH_AMOUNT, ETH);
        vm.prank(lender);
        uint256 loanId = lending.fundRequest{value: ETH_AMOUNT}(requestId);

        vm.prank(owner);
        lending.pause();

        vm.prank(borrower);
        lending.repay{value: lending.totalDue(loanId)}(loanId);

        for (uint256 i = 1; i <= 3; ++i) assertEq(boys.ownerOf(i), borrower);

        vm.prank(lender);
        lending.withdraw(ETH);
    }

    /* ═══════════════════════════ Solvency ════════════════════════════ */

    /// The contract must hold at least what it owes, in both currencies.
    function test_Solvency_BothCurrencies() public {
        uint256 usdgRequest = _request(2, USDG_AMOUNT, USD);
        vm.prank(lender);
        uint256 usdgLoan = lending.fundRequest(usdgRequest);

        vm.prank(lender);
        lending.createOffer{value: ETH_AMOUNT}(
            ETH_AMOUNT,
            INTEREST,
            TERM,
            0,
            1,
            ETH
        );

        vm.prank(borrower);
        lending.repay(usdgLoan);

        assertGe(
            usdg.balanceOf(address(lending)),
            lending.owedUsdg(lender) + lending.owedUsdg(treasury)
        );
        assertGe(address(lending).balance, ETH_AMOUNT, "escrowed offer covered");
    }

    /* ═══════════════════════════ Fuzzing ═════════════════════════════ */

    function testFuzz_EthAnyAmount(uint128 principal, uint16 interestBps) public {
        principal = uint128(bound(principal, 1, 10 ether));
        interestBps = uint16(bound(interestBps, 0, 10_000));

        vm.deal(lender, uint256(principal) * 2 + 1 ether);
        vm.deal(borrower, uint256(principal) * 3 + 1 ether);

        vm.prank(borrower);
        uint256 requestId = lending.createRequest(
            _bundle(2),
            principal,
            interestBps,
            TERM,
            0,
            ETH
        );

        vm.prank(lender);
        uint256 loanId = lending.fundRequest{value: principal}(requestId);

        uint256 due = lending.totalDue(loanId);
        assertGe(due, principal, "never repay less than borrowed");

        vm.prank(borrower);
        lending.repay{value: due}(loanId);

        assertEq(uint8(_loanStatus(loanId)), 2, "repaid");
    }
}
