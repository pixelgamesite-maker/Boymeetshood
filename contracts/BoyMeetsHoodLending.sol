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
 *         collection, denominated in either USDG or native ETH.
 *
 * Two ways in:
 *   REQUESTS — a holder escrows Boys and names what they want for them. Any
 *   wallet can fund it. The borrower needs no capital, only gas.
 *   OFFERS — a lender escrows funds and names what they'll lend against how
 *   many Boys. Any holder can take it.
 *
 * Currency is per-post. A loan denominated in ETH is repaid in ETH: borrow
 * 0.1 ETH, repay 0.1 ETH plus interest, whatever the dollar price does in
 * between. Nothing is converted and no oracle is consulted.
 *
 * Three safety choices worth knowing:
 *
 *   1. PULL PAYMENTS for everything owed to a lender or the treasury. USDG
 *      can freeze addresses and a contract can reject ETH; pushing would let
 *      either block a borrower's repayment and cost them their collateral.
 *
 *   2. PAY-OR-CREDIT for money going to a borrower. Their funds are sent
 *      directly, but if a native transfer fails the amount is credited
 *      instead of reverting — a lender funding a request must never have
 *      their transaction fail because of the borrower's wallet.
 *
 *   3. transferFrom, NOT safeTransferFrom, when releasing collateral. A
 *      lender may be a multisig with no onERC721Received; the receiver check
 *      is worth less than the guarantee that collateral can always leave.
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

    enum Currency {
        USDG,
        ETH
    }

    enum Status {
        None,
        Active,
        Repaid,
        Defaulted
    }

    struct Request {
        address borrower;
        uint128 principal;
        uint16 interestBps;
        uint32 duration;
        uint64 expiresAt; // 0 = never
        Currency currency;
        bool active;
    }

    struct Offer {
        address lender;
        uint128 principal;
        uint16 interestBps;
        uint32 duration;
        uint64 expiresAt; // 0 = never
        uint8 tokenCount;
        Currency currency;
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
        Currency currency;
        Status status;
    }

    /* ────────────────────────────── Storage ────────────────────────────── */

    IERC721 public immutable collection;
    IERC20 public immutable usdg;

    uint16 public feeBps;
    uint16 public constant MAX_FEE_BPS = 500; // 5%
    uint16 public constant MAX_INTEREST_BPS = 10_000; // 100%

    uint32 public constant MIN_DURATION = 1 hours;
    uint32 public constant MAX_DURATION = 365 days;

    /// Capped so a bundle can never be large enough to run out of gas mid
    /// release, which would strand every token in it.
    uint8 public constant MAX_BUNDLE = 20;

    /// Gas forwarded on a native payout. Enough for a normal receive hook,
    /// not enough for a recipient to do anything expensive on our gas.
    uint256 private constant PAYOUT_GAS = 30_000;

    address public treasury;

    uint256 public nextRequestId = 1;
    uint256 public nextOfferId = 1;
    uint256 public nextLoanId = 1;

    mapping(uint256 => Request) public requests;
    mapping(uint256 => Offer) public offers;
    mapping(uint256 => Loan) public loans;

    mapping(uint256 => uint256[]) private _requestTokens;
    mapping(uint256 => uint256[]) private _loanTokens;

    /// Credited but not yet withdrawn, per currency.
    mapping(address => uint256) public owedUsdg;
    mapping(address => uint256) public owedEth;

    /* ─────────────────────────────── Events ────────────────────────────── */

    event RequestCreated(
        uint256 indexed requestId,
        address indexed borrower,
        uint256[] tokenIds,
        uint128 principal,
        uint16 interestBps,
        uint32 duration,
        uint64 expiresAt,
        Currency currency
    );
    event RequestCancelled(uint256 indexed requestId, address indexed borrower);
    event OfferCreated(
        uint256 indexed offerId,
        address indexed lender,
        uint128 principal,
        uint16 interestBps,
        uint32 duration,
        uint64 expiresAt,
        uint8 tokenCount,
        Currency currency
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
        uint64 dueAt,
        Currency currency
    );
    event LoanRepaid(uint256 indexed loanId, address indexed borrower);
    event LoanDefaulted(uint256 indexed loanId, address indexed lender);
    event Withdrawn(address indexed account, Currency currency, uint256 amount);
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
    error BadValue();
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
    error TransferFailed();

    /* ──────────────────────────── Construction ─────────────────────────── */

    constructor(
        address _collection,
        address _usdg,
        address _treasury,
        uint16 _feeBps,
        address _owner
    ) Ownable(_owner) {
        if (
            _collection == address(0) ||
            _usdg == address(0) ||
            _treasury == address(0)
        ) revert ZeroAddress();
        if (_feeBps > MAX_FEE_BPS) revert BadFee();

        collection = IERC721(_collection);
        usdg = IERC20(_usdg);
        treasury = _treasury;
        feeBps = _feeBps;
    }

    /* ───────────────────── Borrower posts a request ────────────────────── */

    /**
     * @notice Escrow Boys and ask for funds against them.
     * @dev Needs no capital, only gas. Caller must own every token and have
     *      approved this contract for the collection.
     */
    function createRequest(
        uint256[] calldata tokenIds,
        uint128 principal,
        uint16 interestBps,
        uint32 duration,
        uint64 expiresAt,
        Currency currency
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
            currency: currency,
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
            expiresAt,
            currency
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
     * @notice Fund someone's request. Funds go to them, the loan starts.
     * @dev For an ETH request, send exactly `principal` as msg.value. For a
     *      USDG request, send no value and approve `principal` first.
     */
    function fundRequest(uint256 requestId)
        external
        payable
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
        Currency currency = request.currency;
        uint128 principal = request.principal;
        address borrower = request.borrower;

        _collect(currency, principal);

        loanId = _openLoan(
            msg.sender,
            borrower,
            principal,
            request.interestBps,
            request.duration,
            currency,
            _requestTokens[requestId]
        );

        _payOut(currency, borrower, principal);
    }

    /* ─────────────────────── Lender posts an offer ─────────────────────── */

    /**
     * @notice Escrow funds and wait for a holder to take them.
     * @param tokenCount How many Boys the borrower must pledge.
     * @dev For an ETH offer, send exactly `principal` as msg.value.
     */
    function createOffer(
        uint128 principal,
        uint16 interestBps,
        uint32 duration,
        uint64 expiresAt,
        uint8 tokenCount,
        Currency currency
    ) external payable nonReentrant whenNotPaused returns (uint256 offerId) {
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
            currency: currency,
            active: true
        });

        _collect(currency, principal);

        emit OfferCreated(
            offerId,
            msg.sender,
            principal,
            interestBps,
            duration,
            expiresAt,
            tokenCount,
            currency
        );
    }

    /// @notice Withdraw an untaken offer. Principal is credited for withdrawal.
    function cancelOffer(uint256 offerId) external nonReentrant {
        Offer storage offer = offers[offerId];
        if (!offer.active) revert Inactive();
        if (offer.lender != msg.sender) revert NotOwnerOfPost();

        offer.active = false;
        _credit(offer.currency, msg.sender, offer.principal);

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
            offer.currency,
            stored
        );

        _payOut(offer.currency, msg.sender, offer.principal);
    }

    /* ──────────────────────────── Loan lifecycle ───────────────────────── */

    /**
     * @notice Repay in full and get every pledged Boy back.
     * @dev For an ETH loan, send exactly totalDue() as msg.value.
     *      Not callable after the deadline: a defaulted loan belongs to the
     *      lender, and racing repay against claimDefault would make the
     *      outcome depend on mempool ordering.
     */
    function repay(uint256 loanId) external payable nonReentrant {
        Loan storage loan = loans[loanId];
        if (loan.status != Status.Active) revert LoanNotActive();
        if (loan.borrower != msg.sender) revert NotBorrower();
        if (block.timestamp > loan.dueAt) revert DeadlinePassed();

        loan.status = Status.Repaid;

        Currency currency = loan.currency;
        uint128 repayAmount = loan.repayAmount;
        uint128 fee = loan.fee;

        _credit(currency, loan.lender, repayAmount);
        if (fee > 0) _credit(currency, treasury, fee);

        _collect(currency, uint256(repayAmount) + fee);
        _releaseTokens(_loanTokens[loanId], msg.sender);

        emit LoanRepaid(loanId, msg.sender);
    }

    /**
     * @notice After the deadline, every pledged Boy goes to the lender.
     * @dev Callable by anyone; collateral always goes to the lender.
     */
    function claimDefault(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        if (loan.status != Status.Active) revert LoanNotActive();
        if (block.timestamp <= loan.dueAt) revert DeadlineNotPassed();

        loan.status = Status.Defaulted;
        _releaseTokens(_loanTokens[loanId], loan.lender);

        emit LoanDefaulted(loanId, loan.lender);
    }

    /// @notice Pull whatever is credited to the caller in one currency.
    function withdraw(Currency currency)
        external
        nonReentrant
        returns (uint256 amount)
    {
        if (currency == Currency.USDG) {
            amount = owedUsdg[msg.sender];
            if (amount == 0) revert NothingOwed();
            owedUsdg[msg.sender] = 0;
            usdg.safeTransfer(msg.sender, amount);
        } else {
            amount = owedEth[msg.sender];
            if (amount == 0) revert NothingOwed();
            owedEth[msg.sender] = 0;
            (bool ok, ) = msg.sender.call{value: amount}("");
            if (!ok) revert TransferFailed();
        }

        emit Withdrawn(msg.sender, currency, amount);
    }

    /* ─────────────────────────────── Views ─────────────────────────────── */

    function requestTokens(uint256 requestId)
        external
        view
        returns (uint256[] memory)
    {
        return _requestTokens[requestId];
    }

    function loanTokens(uint256 loanId) external view returns (uint256[] memory) {
        return _loanTokens[loanId];
    }

    /// @notice Total the borrower must pay to clear a loan.
    function totalDue(uint256 loanId) external view returns (uint256) {
        Loan memory loan = loans[loanId];
        return uint256(loan.repayAmount) + loan.fee;
    }

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

    /// Take `amount` from the caller in `currency`, however that works.
    function _collect(Currency currency, uint256 amount) private {
        if (currency == Currency.ETH) {
            if (msg.value != amount) revert BadValue();
        } else {
            if (msg.value != 0) revert BadValue();
            usdg.safeTransferFrom(msg.sender, address(this), amount);
        }
    }

    /// Credit an internal balance. Never pushes.
    function _credit(Currency currency, address to, uint256 amount) private {
        if (currency == Currency.ETH) {
            owedEth[to] += amount;
        } else {
            owedUsdg[to] += amount;
        }
    }

    /**
     * Pay a borrower directly, falling back to a credit if a native send
     * fails. A lender's funding transaction must not revert because of the
     * borrower's wallet.
     */
    function _payOut(Currency currency, address to, uint256 amount) private {
        if (currency == Currency.USDG) {
            usdg.safeTransfer(to, amount);
            return;
        }

        (bool ok, ) = to.call{value: amount, gas: PAYOUT_GAS}("");
        if (!ok) owedEth[to] += amount;
    }

    function _openLoan(
        address lender,
        address borrower,
        uint128 principal,
        uint16 interestBps,
        uint32 duration,
        Currency currency,
        uint256[] storage tokenIds
    ) private returns (uint256 loanId) {
        uint128 interest = uint128((uint256(principal) * interestBps) / 10_000);
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
            currency: currency,
            status: Status.Active
        });

        // Requests hold collateral under the request id; copy it across.
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
            dueAt,
            currency
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
     * @dev repay(), claimDefault(), withdraw() and both cancels stay open. A
     *      pause must never trap collateral.
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
