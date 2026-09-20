// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BoyMeetsHoodLending
 * @notice Peer-to-peer NFT-collateralised lending for a single ERC-721
 *         collection, settled in a single ERC-20 (USDG).
 *
 * Model:
 *   - A lender posts an offer; their USDG is escrowed immediately, so every
 *     live offer is guaranteed fundable.
 *   - A borrower takes an offer with an eligible token. NFT into escrow,
 *     USDG out to the borrower.
 *   - Repay principal + interest + protocol fee before the deadline and the
 *     NFT is released. Miss it and the lender claims the NFT.
 *   - No auction, no grace period, no extension.
 *
 * Two deliberate design choices worth knowing about:
 *
 *   1. PULL PAYMENTS. Repayment credits an internal balance rather than
 *      pushing USDG to the lender. USDG is Paxos-issued and can freeze
 *      addresses; a push would mean a frozen lender's address makes repay()
 *      revert, and the borrower loses collateral on a loan they were trying
 *      to settle. Lenders call withdraw() on their own schedule.
 *
 *   2. transferFrom, NOT safeTransferFrom, when releasing collateral. A
 *      lender may be a multisig or treasury with no onERC721Received. With
 *      safeTransferFrom, claimDefault() would revert forever and the NFT
 *      would be stuck in escrow permanently. The receiver check is worth less
 *      than the guarantee that collateral can always leave.
 *
 * ⚠️ UNAUDITED. Holds user funds and user NFTs.
 */
contract BoyMeetsHoodLending is
    IERC721Receiver,
    ReentrancyGuard,
    Ownable,
    Pausable
{
    using SafeERC20 for IERC20;

    /* ─────────────────────────────── Types ─────────────────────────────── */

    enum Collateral {
        Any,
        Specific
    }

    enum Status {
        None,
        Active,
        Repaid,
        Defaulted
    }

    struct Offer {
        address lender;
        uint128 principal;
        uint16 interestBps;
        uint32 duration;
        uint64 expiresAt; // 0 = never expires
        Collateral mode;
        uint96 tokenId;
        bool active;
    }

    struct Loan {
        address lender;
        address borrower;
        uint96 tokenId;
        uint128 principal;
        uint128 repayAmount; // principal + interest, owed to the lender
        uint128 fee; // protocol fee, owed to the treasury
        uint64 startedAt;
        uint64 dueAt;
        Status status;
    }

    /* ────────────────────────────── Storage ────────────────────────────── */

    IERC721 public immutable collection;
    IERC20 public immutable currency;

    uint16 public feeBps;
    uint16 public constant MAX_FEE_BPS = 500; // 5%
    uint16 public constant MAX_INTEREST_BPS = 10_000; // 100%

    uint32 public constant MIN_DURATION = 1 hours;
    uint32 public constant MAX_DURATION = 365 days;

    address public treasury;

    uint256 public nextOfferId = 1;
    uint256 public nextLoanId = 1;

    mapping(uint256 => Offer) public offers;
    mapping(uint256 => Loan) public loans;

    /// USDG credited but not yet withdrawn. See design note 1.
    mapping(address => uint256) public owed;

    /* ─────────────────────────────── Events ────────────────────────────── */

    event OfferCreated(
        uint256 indexed offerId,
        address indexed lender,
        uint128 principal,
        uint16 interestBps,
        uint32 duration,
        uint64 expiresAt,
        Collateral mode,
        uint96 tokenId
    );
    event OfferCancelled(uint256 indexed offerId, address indexed lender);
    event LoanStarted(
        uint256 indexed loanId,
        uint256 indexed offerId,
        address indexed borrower,
        address lender,
        uint96 tokenId,
        uint128 principal,
        uint128 repayAmount,
        uint128 fee,
        uint64 dueAt
    );
    event LoanRepaid(
        uint256 indexed loanId,
        address indexed borrower,
        uint128 repayAmount,
        uint128 fee
    );
    event LoanDefaulted(
        uint256 indexed loanId,
        address indexed lender,
        uint96 tokenId
    );
    event Withdrawn(address indexed account, uint256 amount);
    event FeeUpdated(uint16 feeBps);
    event TreasuryUpdated(address treasury);

    /* ─────────────────────────────── Errors ────────────────────────────── */

    error ZeroAddress();
    error ZeroPrincipal();
    error BadInterest();
    error BadDuration();
    error BadFee();
    error BadExpiry();
    error OfferInactive();
    error OfferExpired();
    error NotOfferLender();
    error SelfBorrow();
    error TokenNotEligible();
    error NotTokenOwner();
    error LoanNotActive();
    error NotBorrower();
    error DeadlinePassed();
    error DeadlineNotPassed();
    error NothingOwed();

    /* ──────────────────────────── Construction ─────────────────────────── */

    constructor(
        address _collection,
        address _currency,
        address _treasury,
        uint16 _feeBps,
        address _owner
    ) Ownable(_owner) {
        if (
            _collection == address(0) ||
            _currency == address(0) ||
            _treasury == address(0)
        ) revert ZeroAddress();
        if (_feeBps > MAX_FEE_BPS) revert BadFee();

        collection = IERC721(_collection);
        currency = IERC20(_currency);
        treasury = _treasury;
        feeBps = _feeBps;
    }

    /* ──────────────────────────── Lender side ──────────────────────────── */

    /**
     * @notice Post an offer. Principal is escrowed now.
     * @param expiresAt Unix seconds after which the offer can't be taken.
     *                  0 for no expiry.
     */
    function createOffer(
        uint128 principal,
        uint16 interestBps,
        uint32 duration,
        uint64 expiresAt,
        Collateral mode,
        uint96 tokenId
    ) external nonReentrant whenNotPaused returns (uint256 offerId) {
        if (principal == 0) revert ZeroPrincipal();
        if (interestBps > MAX_INTEREST_BPS) revert BadInterest();
        if (duration < MIN_DURATION || duration > MAX_DURATION) {
            revert BadDuration();
        }
        if (expiresAt != 0 && expiresAt <= block.timestamp) revert BadExpiry();

        offerId = nextOfferId++;
        offers[offerId] = Offer({
            lender: msg.sender,
            principal: principal,
            interestBps: interestBps,
            duration: duration,
            expiresAt: expiresAt,
            mode: mode,
            tokenId: mode == Collateral.Specific ? tokenId : 0,
            active: true
        });

        currency.safeTransferFrom(msg.sender, address(this), principal);

        emit OfferCreated(
            offerId,
            msg.sender,
            principal,
            interestBps,
            duration,
            expiresAt,
            mode,
            tokenId
        );
    }

    /// @notice Withdraw an untaken offer. Principal is credited for withdrawal.
    function cancelOffer(uint256 offerId) external nonReentrant {
        Offer storage offer = offers[offerId];
        if (!offer.active) revert OfferInactive();
        if (offer.lender != msg.sender) revert NotOfferLender();

        offer.active = false;
        owed[msg.sender] += offer.principal;

        emit OfferCancelled(offerId, msg.sender);
    }

    /* ─────────────────────────── Borrower side ─────────────────────────── */

    /// @notice Take a live offer, pledging `tokenId` as collateral.
    function takeOffer(uint256 offerId, uint96 tokenId)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 loanId)
    {
        Offer storage offer = offers[offerId];
        if (!offer.active) revert OfferInactive();
        if (offer.expiresAt != 0 && block.timestamp > offer.expiresAt) {
            revert OfferExpired();
        }
        if (offer.lender == msg.sender) revert SelfBorrow();
        if (offer.mode == Collateral.Specific && offer.tokenId != tokenId) {
            revert TokenNotEligible();
        }
        if (collection.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();

        offer.active = false;

        uint128 principal = offer.principal;
        uint128 interest = uint128(
            (uint256(principal) * offer.interestBps) / 10_000
        );
        // Snapshot the fee so a later setFeeBps can't change what is owed.
        uint128 fee = uint128((uint256(principal) * feeBps) / 10_000);
        uint64 dueAt = uint64(block.timestamp + offer.duration);

        loanId = nextLoanId++;
        loans[loanId] = Loan({
            lender: offer.lender,
            borrower: msg.sender,
            tokenId: tokenId,
            principal: principal,
            repayAmount: principal + interest,
            fee: fee,
            startedAt: uint64(block.timestamp),
            dueAt: dueAt,
            status: Status.Active
        });

        collection.safeTransferFrom(msg.sender, address(this), tokenId);
        currency.safeTransfer(msg.sender, principal);

        emit LoanStarted(
            loanId,
            offerId,
            msg.sender,
            offer.lender,
            tokenId,
            principal,
            principal + interest,
            fee,
            dueAt
        );
    }

    /**
     * @notice Repay in full and get the collateral back.
     * @dev Not callable after the deadline: a defaulted loan belongs to the
     *      lender, and racing repay against claimDefault would make the
     *      outcome depend on mempool ordering.
     */
    function repay(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        if (loan.status != Status.Active) revert LoanNotActive();
        if (loan.borrower != msg.sender) revert NotBorrower();
        if (block.timestamp > loan.dueAt) revert DeadlinePassed();

        loan.status = Status.Repaid;

        uint128 repayAmount = loan.repayAmount;
        uint128 fee = loan.fee;
        uint96 tokenId = loan.tokenId;

        // Credit, don't push — a frozen lender must not block repayment.
        owed[loan.lender] += repayAmount;
        if (fee > 0) owed[treasury] += fee;

        currency.safeTransferFrom(
            msg.sender,
            address(this),
            uint256(repayAmount) + fee
        );
        collection.transferFrom(address(this), msg.sender, tokenId);

        emit LoanRepaid(loanId, msg.sender, repayAmount, fee);
    }

    /**
     * @notice After the deadline, collateral goes to the lender.
     * @dev Callable by anyone; the NFT always goes to the lender, so a lender
     *      without gas isn't stranded and nobody else gains by calling it.
     */
    function claimDefault(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        if (loan.status != Status.Active) revert LoanNotActive();
        if (block.timestamp <= loan.dueAt) revert DeadlineNotPassed();

        loan.status = Status.Defaulted;
        address lender = loan.lender;
        uint96 tokenId = loan.tokenId;

        collection.transferFrom(address(this), lender, tokenId);

        emit LoanDefaulted(loanId, lender, tokenId);
    }

    /* ───────────────────────────── Withdrawals ─────────────────────────── */

    /// @notice Pull whatever USDG is credited to the caller.
    function withdraw() external nonReentrant returns (uint256 amount) {
        amount = owed[msg.sender];
        if (amount == 0) revert NothingOwed();

        owed[msg.sender] = 0;
        currency.safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount);
    }

    /* ─────────────────────────────── Views ─────────────────────────────── */

    /// @notice Total the borrower must pay to clear a loan.
    function totalDue(uint256 loanId) external view returns (uint256) {
        Loan memory loan = loans[loanId];
        return uint256(loan.repayAmount) + loan.fee;
    }

    /// @notice True once a loan is past its deadline and claimable.
    function isDefaulted(uint256 loanId) external view returns (bool) {
        Loan memory loan = loans[loanId];
        return loan.status == Status.Active && block.timestamp > loan.dueAt;
    }

    /// @notice True if an offer can be taken right now.
    function isTakeable(uint256 offerId) external view returns (bool) {
        Offer memory offer = offers[offerId];
        return
            offer.active &&
            (offer.expiresAt == 0 || block.timestamp <= offer.expiresAt);
    }

    /**
     * @notice Page through offer ids that are currently takeable.
     * @dev Convenience only. Past a few thousand offers this will exhaust an
     *      RPC's gas cap — index OfferCreated/OfferCancelled/LoanStarted
     *      events instead.
     */
    function activeOffers(uint256 cursor, uint256 limit)
        external
        view
        returns (uint256[] memory ids, uint256 nextCursor)
    {
        uint256 end = nextOfferId;
        if (cursor == 0) cursor = 1;

        uint256[] memory buffer = new uint256[](limit);
        uint256 found;
        uint256 i = cursor;

        for (; i < end && found < limit; i++) {
            Offer storage offer = offers[i];
            if (
                offer.active &&
                (offer.expiresAt == 0 || block.timestamp <= offer.expiresAt)
            ) {
                buffer[found++] = i;
            }
        }

        ids = new uint256[](found);
        for (uint256 j; j < found; j++) {
            ids[j] = buffer[j];
        }
        nextCursor = i >= end ? 0 : i;
    }

    /* ──────────────────────────────── Admin ────────────────────────────── */

    function setFeeBps(uint16 _feeBps) external onlyOwner {
        if (_feeBps > MAX_FEE_BPS) revert BadFee();
        feeBps = _feeBps;
        emit FeeUpdated(_feeBps);
    }

    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    /**
     * @notice Stop new offers and new loans.
     * @dev repay(), claimDefault() and withdraw() stay open while paused. A
     *      pause must never trap collateral or block recovery.
     */
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /* ─────────────────────────────── ERC721 ────────────────────────────── */

    function onERC721Received(address, address, uint256, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return IERC721Receiver.onERC721Received.selector;
    }
}
