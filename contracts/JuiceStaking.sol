// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

interface IJuiceToken {
    function mint(address to, uint256 amount) external;
}

/**
 * @title JuiceStaking
 * @notice Stake a Boy and earn $JUICE continuously for as long as it stays
 *         staked, boosted by the Boy's rarity. No lock: unstake anytime.
 *
 * Rewards accrue every second at `baseDailyReward * rarityMultiplierBps /
 * 10_000 / 1 days`, from the moment a Boy is staked (or last claimed) until
 * it's claimed or unstaked. There's no fixed total and no lock period —
 * leaving a Boy staked longer simply earns more, and claiming early or
 * often doesn't change the rate going forward.
 *
 * `baseDailyReward` is plain storage, not hardcoded — the owner retunes it
 * with `setBaseDailyReward` (e.g. to track $JUICE's emission budget as the
 * collection or reward schedule changes) without redeploying the contract.
 * Already-CLAIMED rewards are permanent — nothing can change what's already
 * been minted. But a rate or rarity change applies to every stake's whole
 * unclaimed window: pending reward is always `currentRate * (now -
 * lastClaimAt)`, computed fresh at read time, not accrued second-by-second
 * at whatever rate was live at each moment. So a change is effectively
 * retroactive for any time that hasn't been claimed yet — if the owner
 * wants the old rate locked in for time already staked, get holders (or a
 * script) to claim before changing it.
 *
 * Custody is custodial: a staked Boy sits in this contract until unstaked,
 * mirroring BoyMeetsHoodLending's escrow model and the SHACKO reference
 * this was adapted from.
 *
 * ⚠️ UNAUDITED. Holds user NFTs.
 */
contract JuiceStaking is IERC721Receiver, ReentrancyGuard, Ownable, Pausable {
    /* ─────────────────────────────── Types ─────────────────────────────── */

    struct StakeInfo {
        address owner;
        uint40 stakedAt;
        /// @dev Pending reward is always `currentRate * (now - lastClaimAt)`,
        /// recomputed fresh at the CURRENT rate every time it's read — so a
        /// baseDailyReward or rarity change applies to this whole unclaimed
        /// window, not just time going forward. See the contract-level note.
        uint40 lastClaimAt;
        /// @dev Lifetime total minted out for this stake. Informational
        /// only — not used in the reward calculation itself.
        uint256 claimedReward;
        bool isStaked;
    }

    /* ─────────────────────────────── State ──────────────────────────────── */

    IERC721 public immutable boysNft;
    IJuiceToken public immutable juice;
    address public treasury;

    /// @notice Largest bundle `stakeAll` / `claimAllRewards` will walk in one
    /// transaction. Mirrors BoyMeetsHoodLending's MAX_BUNDLE.
    uint16 public constant MAX_BATCH = 50;

    /// @notice Small ETH fee to stake, in wei. Defaults to zero.
    uint256 public stakeFee;

    /// @notice $JUICE earned per day at Common (1x) rarity, 18 decimals.
    /// Plain storage, not hardcoded — retune with setBaseDailyReward as the
    /// emission budget or collection size changes; no redeploy needed.
    uint256 public baseDailyReward;

    mapping(uint256 tokenId => StakeInfo) public stakes;
    mapping(address user => uint256[]) public userStakes;

    /// @notice Per-token rarity tier, e.g. "Rare". Set from the collection's
    /// metadata before staking opens; required before a token can be staked.
    mapping(uint256 tokenId => string) public tokenRarity;

    /// @notice Rarity tier -> multiplier in basis points (10000 = 1x).
    mapping(string rarity => uint256) public rarityMultiplierBps;

    /* ─────────────────────────────── Events ─────────────────────────────── */

    event Staked(address indexed user, uint256 indexed tokenId, uint256 fee);
    event StakedBatch(address indexed user, uint256[] tokenIds, uint256 totalFee);
    event Unstaked(address indexed user, uint256 indexed tokenId, uint256 rewards);
    event RewardsClaimed(address indexed user, uint256 indexed tokenId, uint256 amount);
    event RewardsClaimedBatch(address indexed user, uint256 totalRewards, uint256 tokenCount);
    event RaritySet(uint256 indexed tokenId, string rarity);
    event FeesUpdated(uint256 stakeFee);
    event TreasuryUpdated(address treasury);
    event BaseDailyRewardUpdated(uint256 baseDailyReward);

    /* ─────────────────────────────── Errors ──────────────────────────────── */

    error ZeroAddress();
    error BadBundle();
    error NotTokenOwner();
    error RarityNotSet();
    error AlreadyStaked();
    error NotStaked();
    error NotStakeOwner();
    error InsufficientFee();
    error NothingToClaim();
    error TransferFailed();

    /* ──────────────────────────── Constructor ────────────────────────────── */

    constructor(address _owner, address _boysNft, address _juice, address _treasury, uint256 _baseDailyReward)
        Ownable(_owner)
    {
        if (_boysNft == address(0) || _juice == address(0) || _treasury == address(0)) revert ZeroAddress();

        boysNft = IERC721(_boysNft);
        juice = IJuiceToken(_juice);
        treasury = _treasury;
        baseDailyReward = _baseDailyReward;

        // Rarity boosters, applied to baseDailyReward.
        rarityMultiplierBps["Common"] = 10_000; // 1x
        rarityMultiplierBps["Uncommon"] = 11_500; // 1.15x
        rarityMultiplierBps["Rare"] = 13_500; // 1.35x
        rarityMultiplierBps["Epic"] = 16_000; // 1.6x
        rarityMultiplierBps["Legendary"] = 20_000; // 2x
        rarityMultiplierBps["Mythic"] = 25_000; // 2.5x

        // Stake fee starts at zero; the owner can turn it on later via setFees.
    }

    /* ─────────────────────────────── Staking ──────────────────────────────── */

    function stake(uint256 tokenId) external payable nonReentrant whenNotPaused {
        if (msg.value < stakeFee) revert InsufficientFee();

        _stake(tokenId);
        _forwardFee(msg.value);

        emit Staked(msg.sender, tokenId, msg.value);
    }

    function stakeAll(uint256[] calldata tokenIds) external payable nonReentrant whenNotPaused {
        uint256 count = tokenIds.length;
        if (count == 0 || count > MAX_BATCH) revert BadBundle();
        if (msg.value < stakeFee * count) revert InsufficientFee();

        for (uint256 i = 0; i < count; i++) {
            _stake(tokenIds[i]);
        }
        _forwardFee(msg.value);

        emit StakedBatch(msg.sender, tokenIds, msg.value);
    }

    function _stake(uint256 tokenId) internal {
        // Checked before ownership: once a token is staked it's held by this
        // contract, so `ownerOf` would no longer be msg.sender anyway — this
        // ordering surfaces the more useful "already staked" reason instead
        // of a confusing "not your token".
        if (stakes[tokenId].isStaked) revert AlreadyStaked();
        if (boysNft.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (rarityMultiplierBps[tokenRarity[tokenId]] == 0) revert RarityNotSet();

        // safeTransferFrom: the sender is giving an asset TO this contract,
        // so the receiver-hook check is worth having (see onERC721Received).
        boysNft.safeTransferFrom(msg.sender, address(this), tokenId);

        stakes[tokenId] = StakeInfo({
            owner: msg.sender,
            // forge-lint: disable-next-line(unsafe-typecast)
            stakedAt: uint40(block.timestamp),
            // forge-lint: disable-next-line(unsafe-typecast)
            lastClaimAt: uint40(block.timestamp),
            claimedReward: 0,
            isStaked: true
        });

        userStakes[msg.sender].push(tokenId);
    }

    /* ────────────────────────────── Unstaking ─────────────────────────────── */

    /// @notice Unstake anytime — there's no lock. Pays out whatever's
    /// accrued so far and returns the Boy.
    function unstake(uint256 tokenId) external nonReentrant {
        StakeInfo storage info = stakes[tokenId];
        if (!info.isStaked) revert NotStaked();
        if (info.owner != msg.sender) revert NotStakeOwner();

        uint256 rewards = calculateRewards(tokenId);
        info.claimedReward += rewards;
        info.isStaked = false;
        _removeUserStake(msg.sender, tokenId);

        // transferFrom, not safeTransferFrom — the recipient is whoever
        // staked it, who may be a multisig with no onERC721Received; the
        // guarantee that a Boy can always be withdrawn matters more than
        // the receiver check. Same choice BoyMeetsHoodLending makes.
        boysNft.transferFrom(address(this), msg.sender, tokenId);

        if (rewards > 0) juice.mint(msg.sender, rewards);

        emit Unstaked(msg.sender, tokenId, rewards);
    }

    /* ───────────────────────────── Claiming ───────────────────────────────── */

    function claimRewards(uint256 tokenId) external nonReentrant {
        StakeInfo storage info = stakes[tokenId];
        if (!info.isStaked) revert NotStaked();
        if (info.owner != msg.sender) revert NotStakeOwner();

        uint256 rewards = calculateRewards(tokenId);
        if (rewards == 0) revert NothingToClaim();

        info.claimedReward += rewards;
        // forge-lint: disable-next-line(unsafe-typecast)
        info.lastClaimAt = uint40(block.timestamp);
        juice.mint(msg.sender, rewards);

        emit RewardsClaimed(msg.sender, tokenId, rewards);
    }

    /// @notice Claim across every Boy the caller has staked, in one transaction.
    function claimAllRewards() external nonReentrant {
        uint256[] memory tokenIds = userStakes[msg.sender];
        uint256 count = tokenIds.length;
        if (count == 0) revert NotStaked();
        if (count > MAX_BATCH) revert BadBundle();

        uint256 total = 0;
        uint256 claimedCount = 0;

        for (uint256 i = 0; i < count; i++) {
            StakeInfo storage info = stakes[tokenIds[i]];
            if (!info.isStaked || info.owner != msg.sender) continue;

            uint256 rewards = calculateRewards(tokenIds[i]);
            if (rewards == 0) continue;

            info.claimedReward += rewards;
            // forge-lint: disable-next-line(unsafe-typecast)
            info.lastClaimAt = uint40(block.timestamp);
            total += rewards;
            claimedCount++;
        }

        if (total == 0) revert NothingToClaim();

        juice.mint(msg.sender, total);
        emit RewardsClaimedBatch(msg.sender, total, claimedCount);
    }

    /* ───────────────────────────── Reward math ────────────────────────────── */

    /// @notice Pending, unclaimed rewards for a staked token right now.
    function calculateRewards(uint256 tokenId) public view returns (uint256) {
        StakeInfo memory info = stakes[tokenId];
        if (!info.isStaked) return 0;

        uint256 elapsed = block.timestamp - info.lastClaimAt;
        if (elapsed == 0) return 0;

        return (dailyRewardRate(tokenId) * elapsed) / 1 days;
    }

    /// @notice $JUICE/day this specific token currently earns (baseDailyReward
    /// x its rarity multiplier). Live, not locked in at stake time.
    function dailyRewardRate(uint256 tokenId) public view returns (uint256) {
        uint256 bps = rarityMultiplierBps[tokenRarity[tokenId]];
        return (baseDailyReward * bps) / 10_000;
    }

    /* ─────────────────────────────── Views ────────────────────────────────── */

    function getUserStakes(address user) external view returns (uint256[] memory) {
        return userStakes[user];
    }

    function getStake(uint256 tokenId) external view returns (StakeInfo memory) {
        return stakes[tokenId];
    }

    /* ────────────────────────────── Internal ──────────────────────────────── */

    function _removeUserStake(address user, uint256 tokenId) internal {
        uint256[] storage arr = userStakes[user];
        uint256 len = arr.length;
        for (uint256 i = 0; i < len; i++) {
            if (arr[i] == tokenId) {
                arr[i] = arr[len - 1];
                arr.pop();
                break;
            }
        }
    }

    function _forwardFee(uint256 amount) internal {
        if (amount == 0) return;
        (bool success,) = treasury.call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    /* ────────────────────────────── Admin ─────────────────────────────────── */

    function setTokenRarity(uint256 tokenId, string calldata rarity) external onlyOwner {
        tokenRarity[tokenId] = rarity;
        emit RaritySet(tokenId, rarity);
    }

    function batchSetRarity(uint256[] calldata tokenIds, string[] calldata rarities) external onlyOwner {
        uint256 count = tokenIds.length;
        if (count != rarities.length || count == 0 || count > 500) revert BadBundle();
        for (uint256 i = 0; i < count; i++) {
            tokenRarity[tokenIds[i]] = rarities[i];
            emit RaritySet(tokenIds[i], rarities[i]);
        }
    }

    /// @notice Adjust a rarity tier's multiplier, or add a new tier. Applies
    /// to every affected stake's ENTIRE unclaimed window (time already
    /// staked but not yet claimed included) the next time it's claimed or
    /// unstaked — see the contract-level note. Already-claimed rewards are
    /// unaffected; they're already minted.
    function setRarityMultiplier(string calldata rarity, uint256 bps) external onlyOwner {
        rarityMultiplierBps[rarity] = bps;
    }

    /// @notice Retune the Common-rarity $JUICE/day rate. No redeploy needed.
    /// Applies to every stake's ENTIRE unclaimed window (time already
    /// staked but not yet claimed included) the next time it's claimed or
    /// unstaked — see the contract-level note. Already-claimed rewards are
    /// unaffected; they're already minted. To cut over cleanly, get holders
    /// to claim (or run claimAllRewards for them) before calling this.
    function setBaseDailyReward(uint256 _baseDailyReward) external onlyOwner {
        baseDailyReward = _baseDailyReward;
        emit BaseDailyRewardUpdated(_baseDailyReward);
    }

    function setFees(uint256 _stakeFee) external onlyOwner {
        stakeFee = _stakeFee;
        emit FeesUpdated(_stakeFee);
    }

    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /* ────────────────────────────── Receiver ──────────────────────────────── */

    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    receive() external payable {}
}
