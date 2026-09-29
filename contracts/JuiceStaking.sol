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
 * @notice Lock a Boy up for a fixed term and earn a fixed total amount of
 *         $JUICE for it, boosted by the Boy's rarity.
 *
 * Two things make this different from a typical "X tokens per day" staking
 * contract:
 *
 *   1. FIXED TOTAL PER TERM, not an open-ended daily rate. Choosing a
 *      30/90/180/365-day lock promises a fixed total reward for that Boy at
 *      that duration (before the rarity boost) — 500 / 1,650 / 3,600 /
 *      10,125 $JUICE. That total vests linearly from the moment you stake
 *      and is fully earned exactly at the unlock time; it never keeps
 *      growing if you leave it staked past maturity unclaimed.
 *
 *   2. RARITY BOOSTS THE FIXED TOTAL, not a separate ongoing rate. A token's
 *      rarity multiplies the duration's base total directly (Common 1x up
 *      to Mythic 2.5x), so two Boys staked for the same term always finish
 *      with reward totals in the same ratio as their rarity multipliers,
 *      independent of when either one claims along the way.
 *
 * Rewards accrue as `totalReward * elapsed / termLength`, computed fresh
 * from `stakedAt` every time (not compounded from the last claim), with
 * `elapsed` capped at `termLength`. That means claiming early and often
 * changes nothing about the final total — it only changes how the same
 * fixed payout is split across transactions.
 *
 * Custody is custodial: a staked Boy sits in this contract until unstaked
 * or emergency-unstaked, mirroring BoyMeetsHoodLending's escrow model and
 * the SHACKO reference this was adapted from.
 *
 * ⚠️ UNAUDITED. Holds user NFTs.
 */
contract JuiceStaking is IERC721Receiver, ReentrancyGuard, Ownable, Pausable {
    /* ─────────────────────────────── Types ─────────────────────────────── */

    enum Duration {
        THIRTY,
        NINETY,
        ONE_EIGHTY,
        THREE_SIXTY_FIVE
    }

    struct StakeInfo {
        address owner;
        uint40 stakedAt;
        uint40 unlockTime;
        Duration duration;
        /// @dev Fixed total reward for this stake (duration base x rarity
        /// bps), set once at stake time so a later rarity correction never
        /// changes the terms of an already-running stake.
        uint256 totalReward;
        /// @dev How much of `totalReward` has already been minted out.
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

    /// @notice Small ETH fees, in wei. Both default to zero.
    uint256 public stakeFee;
    uint256 public emergencyUnstakeFee;

    mapping(uint256 tokenId => StakeInfo) public stakes;
    mapping(address user => uint256[]) public userStakes;

    /// @notice Per-token rarity tier, e.g. "Rare". Set from the collection's
    /// metadata before staking opens; required before a token can be staked.
    mapping(uint256 tokenId => string) public tokenRarity;

    /// @notice Rarity tier -> multiplier in basis points (10000 = 1x).
    mapping(string rarity => uint256) public rarityMultiplierBps;

    /* ─────────────────────────────── Events ─────────────────────────────── */

    event Staked(address indexed user, uint256 indexed tokenId, Duration duration, uint256 totalReward, uint256 fee);
    event StakedBatch(address indexed user, uint256[] tokenIds, Duration duration, uint256 totalFee);
    event Unstaked(address indexed user, uint256 indexed tokenId, uint256 rewards);
    event EmergencyUnstake(address indexed user, uint256 indexed tokenId, uint256 forfeitedRewards, uint256 penalty);
    event RewardsClaimed(address indexed user, uint256 indexed tokenId, uint256 amount);
    event RewardsClaimedBatch(address indexed user, uint256 totalRewards, uint256 tokenCount);
    event RaritySet(uint256 indexed tokenId, string rarity);
    event FeesUpdated(uint256 stakeFee, uint256 emergencyUnstakeFee);
    event TreasuryUpdated(address treasury);

    /* ─────────────────────────────── Errors ──────────────────────────────── */

    error ZeroAddress();
    error BadBundle();
    error NotTokenOwner();
    error RarityNotSet();
    error AlreadyStaked();
    error NotStaked();
    error NotStakeOwner();
    error StillLocked();
    error InsufficientFee();
    error NothingToClaim();
    error TransferFailed();

    /* ──────────────────────────── Constructor ────────────────────────────── */

    constructor(address _owner, address _boysNft, address _juice, address _treasury) Ownable(_owner) {
        if (_boysNft == address(0) || _juice == address(0) || _treasury == address(0)) revert ZeroAddress();

        boysNft = IERC721(_boysNft);
        juice = IJuiceToken(_juice);
        treasury = _treasury;

        // Rarity boosters, applied to the duration's base total.
        rarityMultiplierBps["Common"] = 10_000; // 1x
        rarityMultiplierBps["Uncommon"] = 11_500; // 1.15x
        rarityMultiplierBps["Rare"] = 13_500; // 1.35x
        rarityMultiplierBps["Epic"] = 16_000; // 1.6x
        rarityMultiplierBps["Legendary"] = 20_000; // 2x
        rarityMultiplierBps["Mythic"] = 25_000; // 2.5x

        // Fees start at zero; the owner can turn them on later via setFees.
    }

    /* ─────────────────────────────── Staking ──────────────────────────────── */

    function stake(uint256 tokenId, Duration duration) external payable nonReentrant whenNotPaused {
        if (msg.value < stakeFee) revert InsufficientFee();

        _stake(tokenId, duration);
        _forwardFee(msg.value);

        emit Staked(msg.sender, tokenId, duration, stakes[tokenId].totalReward, msg.value);
    }

    function stakeAll(uint256[] calldata tokenIds, Duration duration) external payable nonReentrant whenNotPaused {
        uint256 count = tokenIds.length;
        if (count == 0 || count > MAX_BATCH) revert BadBundle();
        if (msg.value < stakeFee * count) revert InsufficientFee();

        for (uint256 i = 0; i < count; i++) {
            _stake(tokenIds[i], duration);
        }
        _forwardFee(msg.value);

        emit StakedBatch(msg.sender, tokenIds, duration, msg.value);
    }

    function _stake(uint256 tokenId, Duration duration) internal {
        // Checked before ownership: once a token is staked it's held by this
        // contract, so `ownerOf` would no longer be msg.sender anyway — this
        // ordering surfaces the more useful "already staked" reason instead
        // of a confusing "not your token".
        if (stakes[tokenId].isStaked) revert AlreadyStaked();
        if (boysNft.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();

        uint256 bps = rarityMultiplierBps[tokenRarity[tokenId]];
        if (bps == 0) revert RarityNotSet();

        uint256 durationSecs = _durationSeconds(duration);
        uint256 totalReward = (_durationBaseReward(duration) * bps) / 10_000;

        // safeTransferFrom: the sender is giving an asset TO this contract,
        // so the receiver-hook check is worth having (see onERC721Received).
        boysNft.safeTransferFrom(msg.sender, address(this), tokenId);

        // Both casts to uint40 below are safe: it doesn't overflow until the
        // year 36812, and durationSecs is at most 365 days.
        stakes[tokenId] = StakeInfo({
            owner: msg.sender,
            // forge-lint: disable-next-line(unsafe-typecast)
            stakedAt: uint40(block.timestamp),
            // forge-lint: disable-next-line(unsafe-typecast)
            unlockTime: uint40(block.timestamp + durationSecs),
            duration: duration,
            totalReward: totalReward,
            claimedReward: 0,
            isStaked: true
        });

        userStakes[msg.sender].push(tokenId);
    }

    /* ────────────────────────────── Unstaking ─────────────────────────────── */

    function unstake(uint256 tokenId) external nonReentrant {
        StakeInfo storage info = stakes[tokenId];
        if (!info.isStaked) revert NotStaked();
        if (info.owner != msg.sender) revert NotStakeOwner();
        if (block.timestamp < info.unlockTime) revert StillLocked();

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

    /// @notice Exit before the lock ends, forfeiting all accrued rewards.
    function emergencyUnstake(uint256 tokenId) external payable nonReentrant {
        StakeInfo storage info = stakes[tokenId];
        if (!info.isStaked) revert NotStaked();
        if (info.owner != msg.sender) revert NotStakeOwner();
        if (msg.value < emergencyUnstakeFee) revert InsufficientFee();

        uint256 forfeited = calculateRewards(tokenId);
        info.isStaked = false;
        _removeUserStake(msg.sender, tokenId);

        boysNft.transferFrom(address(this), msg.sender, tokenId);
        _forwardFee(msg.value);

        emit EmergencyUnstake(msg.sender, tokenId, forfeited, msg.value);
    }

    /* ───────────────────────────── Claiming ───────────────────────────────── */

    function claimRewards(uint256 tokenId) external nonReentrant {
        StakeInfo storage info = stakes[tokenId];
        if (!info.isStaked) revert NotStaked();
        if (info.owner != msg.sender) revert NotStakeOwner();

        uint256 rewards = calculateRewards(tokenId);
        if (rewards == 0) revert NothingToClaim();

        info.claimedReward += rewards;
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

        uint256 termLength = info.unlockTime - info.stakedAt;
        if (termLength == 0) return info.totalReward - info.claimedReward;

        uint256 effectiveNow = block.timestamp < info.unlockTime ? block.timestamp : info.unlockTime;
        uint256 elapsed = effectiveNow - info.stakedAt;

        // Computed fresh from stakedAt every time (not compounded from the
        // last claim), so it lands on exactly totalReward once elapsed
        // reaches termLength, regardless of how many times it was claimed
        // along the way.
        uint256 accruedTotal = (info.totalReward * elapsed) / termLength;
        if (accruedTotal <= info.claimedReward) return 0;

        return accruedTotal - info.claimedReward;
    }

    function _durationSeconds(Duration duration) internal pure returns (uint256) {
        if (duration == Duration.THIRTY) return 30 days;
        if (duration == Duration.NINETY) return 90 days;
        if (duration == Duration.ONE_EIGHTY) return 180 days;
        return 365 days;
    }

    function _durationBaseReward(Duration duration) internal pure returns (uint256) {
        if (duration == Duration.THIRTY) return 500e18;
        if (duration == Duration.NINETY) return 1_650e18;
        if (duration == Duration.ONE_EIGHTY) return 3_600e18;
        return 10_125e18;
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

    /// @notice Adjust a rarity tier's multiplier, or add a new tier. Only
    /// affects stakes made after the change — running stakes keep the
    /// totalReward they were locked in with.
    function setRarityMultiplier(string calldata rarity, uint256 bps) external onlyOwner {
        rarityMultiplierBps[rarity] = bps;
    }

    function setFees(uint256 _stakeFee, uint256 _emergencyUnstakeFee) external onlyOwner {
        stakeFee = _stakeFee;
        emergencyUnstakeFee = _emergencyUnstakeFee;
        emit FeesUpdated(_stakeFee, _emergencyUnstakeFee);
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
