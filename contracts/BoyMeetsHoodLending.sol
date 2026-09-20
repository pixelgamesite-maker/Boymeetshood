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
 * Two ways in, because both sides of a market need to be able to start one:
 *
 *   REQUESTS — a holder escrows one or more Boys and says what they want for
 *   them: amount, interest, term. Any wallet with USDG can fund it. This is
 *   the "I need funds today" path, and it needs no USDG from the borrower.
 *
 *   OFFERS — a lender escrows USDG and says what they'll lend against how
 *   many Boys. Any holder can take it. This is the "liquidity waiting on the
 *   book" path, and it needs no Boy from the lender.
 *
 * Either way the result is the same Loan, repaid the same way.
 *
 * Bundles: collateral is an array throughout. Repayment releases every token;
 * default transfers every token. All or nothing, never partial.
 *
 * No oracle and no floor-price check. Both sides set their own terms and can
 * see the market before they commit. A floor feed for a 2,666-piece
 * collection is thin enough to manipulate, and enforcing one on-chain would
 * make the protocol only as trustworthy as the feed.
 *
 * Funds are credited rather than pushed (see withdraw), and collateral is
 * released with transferFrom rather than safeTransferFrom. Both exist so that
 * a frozen USDG address or a contract that can't receive ERC-721s can never
 * trap someone else's assets.
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

    enum Status {
        None,
        Active,
        Repaid,
        Defaulted
    }

    /// Posted by a borrower. Collateral is already in escrow.
    struct Request {
        address borrower;
        uint128 principal; // USDG wanted
        uint16 interestBps; // interest for the full term
        uint32 duration; // seconds
        uint64 expiresAt; // 0 = never
        bool active;
    }

    /// Posted by a lender. USDG is already in escrow.
    struct Offer {
        address lender;
        uint128 principal; // USDG on the table
        uint16 interestBps;
        uint32 duration;
        uint64 expiresAt; // 0 = never
        uint8 tokenCount; // how many Boys the borrower must pledge
        bool active;
    }

    struct Loan {
        address lender;
        address borrower;
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

    /// Capped so a bundle can never be large enough to run out of gas mid
    /// release, which would strand every token in it.
    uint8 public constant MAX_BUNDLE = 20;

    address public treasury;

    uint256 public nextRequestId = 1;
    uint256 public nextOfferId = 1;
    uint256 public nextLoanId = 1;

    mapping(uint256 => Request) public requests;
    mapping(uint256 => Offer) public offers;
    mapping(uint256 => Loan) public loans;

    /// Collateral for each request and each loan.
    mapping(uint256 => uint256[]) private _requestTokens;
    mapping(uint256 => uint256[]) private _loanTokens;

    /// USDG credited but not yet withdrawn.
    mapping(address => uint256) public owed;

    /* ─────────────────────────────── Events ────────────────────────────── */

    event RequestCreated(
        uint256 indexed requestId,
        address indexed borrower,
        uint256[] tokenIds,
        uint128 principal,
        uint16 interestBps,
        uint32 duration,
        uint64 expiresAt
    );
    event RequestCancelled(uint256 indexed requestId, address indexed borrower);
    event OfferCreated(
        uint256 indexed offerId,
        address indexed lender,
        uint128 principal,
        uint16 interestBps,
        uint32 duration,
        uint64 expiresAt,
        uint8 tokenCount
    );
    event OfferCancelled(uint256 indexed offerId, address indexed lender);
    event LoanStarted(
        uint256 indexed loanId,
        address indexed borrower,
        address indexed lender,
        uint256[] tokenIds,
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
    event LoanDefaulted(uint256 indexed loanId, address indexed lender);
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
    error BadBundle();
    error Inactive();
    error Expired();
    error NotOwnerOfPost();
    error SelfDeal();
    error NotTokenOwner();
    error WrongTokenCount();
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

    /* ───────────────────── Borrower posts a request ────────────────────── */

    /**
     * @notice Escrow Boys and ask for USDG against them.
     * @dev Needs no USDG — only gas. Caller must own every token and have
     *      approved this contract for the collection.
     */
    function createRequest(
        uint256[] calldata tokenIds,
        uint128 principal,
        uint16 interestBps,
        uint32 duration,
        uint64 expiresAt
    ) external nonReentrant whenNotPaused returns (uint256 requestId) {
        _validateTerms(principal, interestBps, duration, expiresAt);
        if (tokenIds.length == 0 || tokenIds.length > MAX_BUNDLE) {
            revert BadBundle();
        }

        requestId = nextRequestId++;
        requests[requestId] = Request({
            borrower: msg.sender,
            principal: principal,
            interestBps: interestBps,
            duration: duration,
            expiresAt: expiresAt,
            active: true
        });

        uint256[] storage stored = _requestTokens[requestId];
        for (uint256 i; i < tokenIds.length; ++i) {
            uint256 tokenId = tokenIds[i];
            if (collection.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
            stored.push(tokenId);
            collection.safeTransferFrom(msg.sender, address(this), tokenId);
        }

        emit RequestCreated(
            requestId,
            msg.sender,
            tokenIds,
            principal,
            interestBps,
            duration,
            expiresAt
        );
    }

    /// @notice Withdraw an unfunded request and take the Boys back.
    function cancelRequest(uint256 requestId) external nonReentrant {
        Request storage request = requests[requestId];
        if (!request.active) revert Inactive();
        if (request.borrower != msg.sender) revert NotOwnerOfPost();

        request.active = false;
        _releaseTokens(_requestTokens[requestId], msg.sender);

        emit RequestCancelled(requestId, msg.sender);
    }

    /**
     * @notice Fund someone's request. USDG goes to them, the loan starts.
     * @dev Caller must have approved `principal` of `currency`.
     */
    function fundRequest(uint256 requestId)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 loanId)
    {
        Request storage request = requests[requestId];
        if (!request.active) revert Inactive();
        if (request.expiresAt != 0 && block.timestamp > request.expiresAt) {
            revert Expired();
        }
        if (request.borrower == msg.sender) revert SelfDeal();

        request.active = false;

        loanId = _openLoan(
            msg.sender,
            request.borrower,
            request.principal,
            request.interestBps,
            request.duration,
            _requestTokens[requestId]
        );

        currency.safeTransferFrom(msg.sender, request.borrower, request.principal);
    }

    /* ─────────────────────── Lender posts an offer ─────────────────────── */

    /**
     * @notice Escrow USDG and wait for a holder to take it.
     * @param tokenCount How many Boys the borrower must pledge. The borrower
     *                   chooses which.
     */
    function createOffer(
        uint128 principal,
        uint16 interestBps,
        uint32 duration,
        uint64 expiresAt,
        uint8 tokenCount
    ) external nonReentrant whenNotPaused returns (uint256 offerId) {
        _validateTerms(principal, interestBps, duration, expiresAt);
        if (tokenCount == 0 || tokenCount > MAX_BUNDLE) revert BadBundle();

        offerId = nextOfferId++;
        offers[offerId] = Offer({
            lender: msg.sender,
            principal: principal,
            interestBps: interestBps,
            duration: duration,
            expiresAt: expiresAt,
            tokenCount: tokenCount,
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
            tokenCount
        );
    }

    /// @notice Withdraw an untaken offer. Principal is credited for withdrawal.
    function cancelOffer(uint256 offerId) external nonReentrant {
        Offer storage offer = offers[offerId];
        if (!offer.active) revert Inactive();
        if (offer.lender != msg.sender) revert NotOwnerOfPost();

        offer.active = false;
        owed[msg.sender] += offer.principal;

        emit OfferCancelled(offerId, msg.sender);
    }

    /// @notice Take a live offer, pledging exactly `tokenCount` Boys.
    function takeOffer(uint256 offerId, uint256[] calldata tokenIds)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 loanId)
    {
        Offer storage offer = offers[offerId];
        if (!offer.active) revert Inactive();
        if (offer.expiresAt != 0 && block.timestamp > offer.expiresAt) {
            revert Expired();
        }
        if (offer.lender == msg.sender) revert SelfDeal();
        if (tokenIds.length != offer.tokenCount) revert WrongTokenCount();

        offer.active = false;

        loanId = nextLoanId;
        uint256[] storage stored = _loanTokens[loanId];
        for (uint256 i; i < tokenIds.length; ++i) {
            uint256 tokenId = tokenIds[i];
            if (collection.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
            stored.push(tokenId);
            collection.safeTransferFrom(msg.sender, address(this), tokenId);
        }

        _openLoan(
            offer.lender,
            msg.sender,
            offer.principal,
            offer.interestBps,
            offer.duration,
            stored
        );

        currency.safeTransfer(msg.sender, offer.principal);
    }

    /* ──────────────────────────── Loan lifecycle ───────────────────────── */

    /**
     * @notice Repay in full and get every pledged Boy back.
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

        owed[loan.lender] += repayAmount;
        if (fee > 0) owed[treasury] += fee;

        currency.safeTransferFrom(
            msg.sender,
            address(this),
            uint256(repayAmount) + fee
        );
        _releaseTokens(_loanTokens[loanId], msg.sender);

        emit LoanRepaid(loanId, msg.sender, repayAmount, fee);
    }

    /**
     * @notice After the deadline, every pledged Boy goes to the lender.
     * @dev Callable by anyone; collateral always goes to the lender, so a
     *      lender without gas isn't stranded and nobody else gains by calling.
     */
    function claimDefault(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        if (loan.status != Status.Active) revert LoanNotActive();
        if (block.timestamp <= loan.dueAt) revert DeadlineNotPassed();

        loan.status = Status.Defaulted;
        _releaseTokens(_loanTokens[loanId], loan.lender);

        emit LoanDefaulted(loanId, loan.lender);
    }

    /// @notice Pull whatever USDG is credited to the caller.
    function withdraw() external nonReentrant returns (uint256 amount) {
        amount = owed[msg.sender];
        if (amount == 0) revert NothingOwed();

        owed[msg.sender] = 0;
        currency.safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount);
    }

    /* ─────────────────────────────── Views ─────────────────────────────── */

    function requestTokens(uint256 requestId)
        external
        view
        returns (uint256[] memory)
    {
        return _requestTokens[requestId];
    }

    function loanTokens(uint256 loanId)
        external
        view
        returns (uint256[] memory)
    {
        return _loanTokens[loanId];
    }

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

    /* ────────────────────────────── Internals ──────────────────────────── */

    function _validateTerms(
        uint128 principal,
        uint16 interestBps,
        uint32 duration,
        uint64 expiresAt
    ) private view {
        if (principal == 0) revert ZeroPrincipal();
        if (interestBps > MAX_INTEREST_BPS) revert BadInterest();
        if (duration < MIN_DURATION || duration > MAX_DURATION) {
            revert BadDuration();
        }
        if (expiresAt != 0 && expiresAt <= block.timestamp) revert BadExpiry();
    }

    function _openLoan(
        address lender,
        address borrower,
        uint128 principal,
        uint16 interestBps,
        uint32 duration,
        uint256[] storage tokenIds
    ) private returns (uint256 loanId) {
        uint128 interest = uint128(
            (uint256(principal) * interestBps) / 10_000
        );
        // Snapshot the fee so a later setFeeBps can't change what is owed.
        uint128 fee = uint128((uint256(principal) * feeBps) / 10_000);
        uint64 dueAt = uint64(block.timestamp + duration);

        loanId = nextLoanId++;
        loans[loanId] = Loan({
            lender: lender,
            borrower: borrower,
            principal: principal,
            repayAmount: principal + interest,
            fee: fee,
            startedAt: uint64(block.timestamp),
            dueAt: dueAt,
            status: Status.Active
        });

        // Requests hold their collateral under the request id; move it across.
        uint256[] storage loanTokenList = _loanTokens[loanId];
        if (loanTokenList.length == 0) {
            for (uint256 i; i < tokenIds.length; ++i) {
                loanTokenList.push(tokenIds[i]);
            }
        }

        emit LoanStarted(
            loanId,
            borrower,
            lender,
            loanTokenList,
            principal,
            principal + interest,
            fee,
            dueAt
        );
    }

    /// transferFrom, not safeTransferFrom — see the contract notes.
    function _releaseTokens(uint256[] storage tokenIds, address to) private {
        for (uint256 i; i < tokenIds.length; ++i) {
            collection.transferFrom(address(this), to, tokenIds[i]);
        }
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
     * @notice Stop new requests, offers and loans.
     * @dev repay(), claimDefault(), withdraw(), cancelRequest() and
     *      cancelOffer() stay open. A pause must never trap collateral.
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
