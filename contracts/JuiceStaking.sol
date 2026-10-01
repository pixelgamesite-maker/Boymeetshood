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
 * @notice Lock a Boy for a fixed term and earn $JUICE continuously, boosted by
 *         both the Boy's rarity and the lock length. The Boy can't be withdrawn
 *         until the term ends; rewards can be claimed anytime during the term.
 *
 * DURATIONS ARE EDITABLE. A lock tier is just a number of days with a reward
 * multiplier, held in storage — the owner can add, retune or remove tiers with
 * `setDuration(days, bps)` and never needs to redeploy. Seeded at launch with
 * 1 / 3 / 6 / 12 months at 0.5x / 1x / 1.5x / 2.5x.
 *
 * REWARD RATE, snapshotted at stake time:
 *
 *     dailyRate = baseDailyReward
 *               * rarityMultiplierBps[rarity]        / 10_000
 *               * durationMultiplierBps[durationDays] / 10_000
 *
 * The rate is locked in when you stake, so later owner changes to
 * baseDailyReward or any multiplier only affect stakes made after them.
 *
 * ACCRUAL is continuous but bounded by the term: rewards accrue second by
 * second from `lastClaimAt` and stop at the unlock time. Leaving a Boy staked
 * past unlock earns nothing extra — unstake it or stake it again.
 *
 * Custody is custodial; there is no early exit.
 *
 * ⚠️ UNAUDITED. Holds user NFTs.
 */
contract JuiceStaking is IERC721Receiver, ReentrancyGuard, Ownable, Pausable {
    /* ─────────────────────────────── Types ─────────────────────────────── */

    struct StakeInfo {
        address owner;
        uint40 stakedAt;
        uint40 unlockTime;
        uint40 lastClaimAt;
        /// @dev Lock length in days, snapshotted (also the key into
        /// durationMultiplierBps at stake time).
        uint32 durationDays;
        /// @dev Effective $JUICE/day for this stake (base x rarity x duration),
        /// snapshotted at stake time so later changes never alter it.
        uint256 rewardRate;
        /// @dev Lifetime total minted out for this stake. Informational.
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

    /// @notice $JUICE/day at Common rarity, 1x duration (both multipliers 1x).
    /// Owner-settable; only affects stakes made after a change.
    uint256 public baseDailyReward;

    mapping(uint256 tokenId => StakeInfo) public stakes;
    mapping(address user => uint256[]) public userStakes;

    /// @notice Per-token rarity tier, e.g. "Rare". Required before staking.
    mapping(uint256 tokenId => string) public tokenRarity;

    /// @notice Rarity tier -> multiplier in basis points (10000 = 1x).
    mapping(string rarity => uint256) public rarityMultiplierBps;

    /// @notice Lock length (in days) -> multiplier in basis points. A tier is
    /// available iff its multiplier is non-zero.
    mapping(uint256 durationDays => uint256) public durationMultiplierBps;

    /// @dev The currently-available lock tiers, for the UI to enumerate.
    uint256[] private _durations;

    /* ─────────────────────────────── Events ─────────────────────────────── */

    event Staked(
        address indexed user,
        uint256 indexed tokenId,
        uint32 durationDays,
        uint40 unlockTime,
        uint256 dailyRate,
        uint256 fee
    );
    event StakedBatch(address indexed user, uint256[] tokenIds, uint32 durationDays, uint256 totalFee);
    event Unstaked(address indexed user, uint256 indexed tokenId, uint256 rewards);
    event RewardsClaimed(address indexed user, uint256 indexed tokenId, uint256 amount);
    event RewardsClaimedBatch(address indexed user, uint256 totalRewards, uint256 tokenCount);
    event RaritySet(uint256 indexed tokenId, string rarity);
    event FeesUpdated(uint256 stakeFee);
    event TreasuryUpdated(address treasury);
    event BaseDailyRewardUpdated(uint256 baseDailyReward);
    event DurationSet(uint256 indexed durationDays, uint256 bps);

    /* ─────────────────────────────── Errors ──────────────────────────────── */

    error ZeroAddress();
    error BadBundle();
    error BadDuration();
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

    constructor(address _owner, address _boysNft, address _juice, address _treasury, uint256 _baseDailyReward)
        Ownable(_owner)
    {
        if (_boysNft == address(0) || _juice == address(0) || _treasury == address(0)) revert ZeroAddress();

        boysNft = IERC721(_boysNft);
        juice = IJuiceToken(_juice);
        treasury = _treasury;
        baseDailyReward = _baseDailyReward;

        // Rarity boosters.
        rarityMultiplierBps["Common"] = 10_000; // 1x
        rarityMultiplierBps["Uncommon"] = 11_500; // 1.15x
        rarityMultiplierBps["Rare"] = 13_500; // 1.35x
        rarityMultiplierBps["Epic"] = 16_000; // 1.6x
        rarityMultiplierBps["Legendary"] = 20_000; // 2x
        rarityMultiplierBps["Mythic"] = 25_000; // 2.5x

        // Lock tiers (days -> booster). Editable later via setDuration.
        _setDuration(30, 5_000); // 1 month, 0.5x
        _setDuration(90, 10_000); // 3 months, 1x
        _setDuration(180, 15_000); // 6 months, 1.5x
        _setDuration(365, 25_000); // 12 months, 2.5x

        // Stake fee starts at zero; the owner can turn it on later via setFees.
    }

    /* ─────────────────────────────── Staking ──────────────────────────────── */

    function stake(uint256 tokenId, uint256 durationDays) external payable nonReentrant whenNotPaused {
        if (msg.value < stakeFee) revert InsufficientFee();

        _stake(tokenId, durationDays);
        _forwardFee(msg.value);
    }

    function stakeAll(uint256[] calldata tokenIds, uint256 durationDays)
        external
        payable
        nonReentrant
        whenNotPaused
    {
        uint256 count = tokenIds.length;
        if (count == 0 || count > MAX_BATCH) revert BadBundle();
        if (msg.value < stakeFee * count) revert InsufficientFee();

        for (uint256 i = 0; i < count; i++) {
            _stake(tokenIds[i], durationDays);
        }
        _forwardFee(msg.value);

        // forge-lint: disable-next-line(unsafe-typecast)
        emit StakedBatch(msg.sender, tokenIds, uint32(durationDays), msg.value);
    }

    function _stake(uint256 tokenId, uint256 durationDays) internal {
        if (stakes[tokenId].isStaked) revert AlreadyStaked();
        if (boysNft.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();

        uint256 rate = _quoteDailyRate(tokenId, durationDays); // reverts if rarity/duration invalid

        boysNft.safeTransferFrom(msg.sender, address(this), tokenId);

        // forge-lint: disable-next-line(unsafe-typecast)
        uint40 nowTs = uint40(block.timestamp);
        // forge-lint: disable-next-line(unsafe-typecast)
        uint40 unlock = uint40(block.timestamp + durationDays * 1 days);

        stakes[tokenId] = StakeInfo({
            owner: msg.sender,
            stakedAt: nowTs,
            unlockTime: unlock,
            lastClaimAt: nowTs,
            // forge-lint: disable-next-line(unsafe-typecast)
            durationDays: uint32(durationDays),
            rewardRate: rate,
            claimedReward: 0,
            isStaked: true
        });

        userStakes[msg.sender].push(tokenId);

        // forge-lint: disable-next-line(unsafe-typecast)
        emit Staked(msg.sender, tokenId, uint32(durationDays), unlock, rate, 0);
    }

    /* ────────────────────────────── Unstaking ─────────────────────────────── */

    /// @notice Withdraw a Boy after its lock term ends, paying out any
    /// remaining accrued rewards. Reverts until the unlock time.
    function unstake(uint256 tokenId) external nonReentrant {
        StakeInfo storage info = stakes[tokenId];
        if (!info.isStaked) revert NotStaked();
        if (info.owner != msg.sender) revert NotStakeOwner();
        if (block.timestamp < info.unlockTime) revert StillLocked();

        uint256 rewards = calculateRewards(tokenId);
        info.claimedReward += rewards;
        info.isStaked = false;
        _removeUserStake(msg.sender, tokenId);

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

    /// @notice Pending, unclaimed rewards for a staked token right now. Accrual
    /// is bounded by the unlock time — nothing accrues past the end of the term.
    function calculateRewards(uint256 tokenId) public view returns (uint256) {
        StakeInfo memory info = stakes[tokenId];
        if (!info.isStaked) return 0;

        uint256 end = block.timestamp < info.unlockTime ? block.timestamp : info.unlockTime;
        if (end <= info.lastClaimAt) return 0;

        return (info.rewardRate * (end - info.lastClaimAt)) / 1 days;
    }

    /// @notice Quote the $JUICE/day a (token, duration) pair would earn at the
    /// current rates — for UI estimates. Reverts if the token's rarity isn't
    /// set or the duration isn't an available tier.
    function quoteDailyRate(uint256 tokenId, uint256 durationDays) external view returns (uint256) {
        return _quoteDailyRate(tokenId, durationDays);
    }

    function _quoteDailyRate(uint256 tokenId, uint256 durationDays) internal view returns (uint256) {
        uint256 rarityBps = rarityMultiplierBps[tokenRarity[tokenId]];
        if (rarityBps == 0) revert RarityNotSet();
        uint256 durBps = durationMultiplierBps[durationDays];
        if (durBps == 0) revert BadDuration();
        return (baseDailyReward * rarityBps * durBps) / (10_000 * 10_000);
    }

    /* ─────────────────────────────── Views ────────────────────────────────── */

    /// @notice The currently-available lock tiers, in days.
    function getDurations() external view returns (uint256[] memory) {
        return _durations;
    }

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

    function _setDuration(uint256 durationDays, uint256 bps) internal {
        if (durationDays == 0) revert BadDuration();
        uint256 prev = durationMultiplierBps[durationDays];
        durationMultiplierBps[durationDays] = bps;

        if (bps > 0 && prev == 0) {
            _durations.push(durationDays);
        } else if (bps == 0 && prev > 0) {
            uint256 len = _durations.length;
            for (uint256 i = 0; i < len; i++) {
                if (_durations[i] == durationDays) {
                    _durations[i] = _durations[len - 1];
                    _durations.pop();
                    break;
                }
            }
        }

        emit DurationSet(durationDays, bps);
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

    /// @notice Adjust a rarity tier's multiplier. Only affects stakes made
    /// after the change — running stakes keep their snapshotted rate.
    function setRarityMultiplier(string calldata rarity, uint256 bps) external onlyOwner {
        rarityMultiplierBps[rarity] = bps;
    }

    /// @notice Add, retune, or remove a lock tier WITHOUT redeploying.
    /// `bps > 0` adds or updates the tier; `bps == 0` removes it (no new
    /// stakes can pick it, existing stakes keep their snapshotted rate).
    /// Only affects stakes made after the change.
    function setDuration(uint256 durationDays, uint256 bps) external onlyOwner {
        _setDuration(durationDays, bps);
    }

    /// @notice Retune the base $JUICE/day rate. Only affects stakes made after
    /// the change — running stakes keep their snapshotted rate.
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
