// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title AgentStaking
 * @dev Staking contract for BoredBrain AI agent registration.
 *
 * Users must stake 100 BBAI to register an AI agent on the platform.
 * Staked tokens are locked for 30 days before they can be withdrawn.
 *
 * NFT Tier Discounts:
 * - Ape Tier (BAYC/MAYC holders): 50% discount -> 50 BBAI stake
 * - Bluechip Tier (other bluechip NFT holders): 25% discount -> 75 BBAI stake
 * - Standard: 100 BBAI stake (no discount)
 *
 * The contract verifies NFT ownership at stake time to determine the discount.
 */
contract AgentStaking is Ownable, ReentrancyGuard, Pausable {

    // ========== Constants ==========

    uint256 public constant BASE_STAKE_AMOUNT = 100 * 10**18;  // 100 BBAI
    uint256 public constant LOCK_DURATION = 30 days;
    uint256 public constant APE_DISCOUNT_BPS = 5000;           // 50% discount
    uint256 public constant BLUECHIP_DISCOUNT_BPS = 2500;      // 25% discount
    uint256 public constant BPS_DENOMINATOR = 10000;

    // ========== State Variables ==========

    /// @notice The BBAI token contract
    IERC20 public immutable bbaiToken;

    /// @notice NFT collections that qualify for Ape Tier (50% discount)
    mapping(address => bool) public isApeTier;

    /// @notice NFT collections that qualify for Bluechip Tier (25% discount)
    mapping(address => bool) public isBluechipTier;

    // ========== Staking Data ==========

    struct Stake {
        uint256 amount;         // Actual amount staked (after discount)
        uint256 stakedAt;       // Timestamp of staking
        uint256 unlockAt;       // Timestamp when unstaking is allowed
        address nftUsed;        // NFT contract used for discount (address(0) if none)
        uint256 nftTokenId;     // Token ID of NFT used for discount
        bool active;            // Whether the stake is still active
    }

    /// @notice staker address => agent ID => Stake
    mapping(address => mapping(uint256 => Stake)) public stakes;

    /// @notice Total number of active stakes
    uint256 public totalActiveStakes;

    /// @notice Total BBAI currently locked in staking
    uint256 public totalStakedAmount;

    /// @notice Agent ID => whether an agent has been registered via staking
    mapping(uint256 => bool) public agentRegistered;

    /// @notice Tracks all agent IDs staked by an address
    mapping(address => uint256[]) private _stakerAgents;

    // ========== Events ==========

    event AgentStaked(
        address indexed staker,
        uint256 indexed agentId,
        uint256 amount,
        uint256 discount,
        address nftUsed,
        uint256 unlockAt
    );

    event AgentUnstaked(
        address indexed staker,
        uint256 indexed agentId,
        uint256 amount
    );

    event ApeTierUpdated(address indexed nftContract, bool eligible);
    event BluechipTierUpdated(address indexed nftContract, bool eligible);
    event EmergencyUnstake(address indexed staker, uint256 indexed agentId, uint256 amount);

    // ========== Constructor ==========

    /**
     * @param _bbaiToken Address of the BBAI ERC-20 token
     * @param initialOwner Owner of this contract
     */
    constructor(
        address _bbaiToken,
        address initialOwner
    ) Ownable(initialOwner) {
        require(_bbaiToken != address(0), "AgentStaking: token is zero address");
        bbaiToken = IERC20(_bbaiToken);
    }

    // ========== Core Staking ==========

    /**
     * @dev Stake BBAI to register an agent. No NFT discount applied.
     * @param agentId Unique identifier for the agent being registered
     */
    function stake(uint256 agentId) external nonReentrant whenNotPaused {
        _stakeInternal(agentId, address(0), 0);
    }

    /**
     * @dev Stake BBAI with an NFT discount for agent registration.
     *      The caller must own the NFT at the time of staking.
     *
     * @param agentId Unique identifier for the agent being registered
     * @param nftContract Address of the NFT collection (must be Ape or Bluechip tier)
     * @param nftTokenId Token ID within the NFT collection that the caller owns
     */
    function stakeWithNFTDiscount(
        uint256 agentId,
        address nftContract,
        uint256 nftTokenId
    ) external nonReentrant whenNotPaused {
        require(nftContract != address(0), "AgentStaking: NFT contract is zero address");
        require(
            isApeTier[nftContract] || isBluechipTier[nftContract],
            "AgentStaking: NFT not in any discount tier"
        );

        // Verify caller owns the NFT
        IERC721 nft = IERC721(nftContract);
        require(
            nft.ownerOf(nftTokenId) == msg.sender,
            "AgentStaking: caller does not own this NFT"
        );

        _stakeInternal(agentId, nftContract, nftTokenId);
    }

    /**
     * @dev Internal staking logic shared by both stake functions.
     */
    function _stakeInternal(
        uint256 agentId,
        address nftContract,
        uint256 nftTokenId
    ) internal {
        require(!stakes[msg.sender][agentId].active, "AgentStaking: already staked for this agent");
        require(!agentRegistered[agentId], "AgentStaking: agent already registered");

        // Calculate stake amount with discount
        uint256 stakeAmount = _calculateStakeAmount(nftContract);
        uint256 discount = BASE_STAKE_AMOUNT - stakeAmount;

        // Transfer BBAI from staker to this contract
        require(
            bbaiToken.transferFrom(msg.sender, address(this), stakeAmount),
            "AgentStaking: token transfer failed"
        );

        uint256 unlockAt = block.timestamp + LOCK_DURATION;

        stakes[msg.sender][agentId] = Stake({
            amount: stakeAmount,
            stakedAt: block.timestamp,
            unlockAt: unlockAt,
            nftUsed: nftContract,
            nftTokenId: nftTokenId,
            active: true
        });

        agentRegistered[agentId] = true;
        totalActiveStakes++;
        totalStakedAmount += stakeAmount;
        _stakerAgents[msg.sender].push(agentId);

        emit AgentStaked(msg.sender, agentId, stakeAmount, discount, nftContract, unlockAt);
    }

    /**
     * @dev Unstake BBAI after the 30-day lock period.
     * @param agentId The agent ID to unstake from
     */
    function unstake(uint256 agentId) external nonReentrant {
        Stake storage s = stakes[msg.sender][agentId];
        require(s.active, "AgentStaking: no active stake");
        require(block.timestamp >= s.unlockAt, "AgentStaking: stake still locked");

        uint256 amount = s.amount;

        s.active = false;
        s.amount = 0;
        agentRegistered[agentId] = false;
        totalActiveStakes--;
        totalStakedAmount -= amount;

        require(
            bbaiToken.transfer(msg.sender, amount),
            "AgentStaking: transfer failed"
        );

        emit AgentUnstaked(msg.sender, agentId, amount);
    }

    // ========== View Functions ==========

    /**
     * @dev Calculate the stake amount based on NFT tier discount.
     */
    function _calculateStakeAmount(address nftContract) internal view returns (uint256) {
        if (nftContract == address(0)) {
            return BASE_STAKE_AMOUNT; // No discount: 100 BBAI
        }

        if (isApeTier[nftContract]) {
            // 50% discount: 50 BBAI
            return BASE_STAKE_AMOUNT - (BASE_STAKE_AMOUNT * APE_DISCOUNT_BPS) / BPS_DENOMINATOR;
        }

        if (isBluechipTier[nftContract]) {
            // 25% discount: 75 BBAI
            return BASE_STAKE_AMOUNT - (BASE_STAKE_AMOUNT * BLUECHIP_DISCOUNT_BPS) / BPS_DENOMINATOR;
        }

        return BASE_STAKE_AMOUNT;
    }

    /**
     * @dev Get the required stake amount for a given NFT contract (public view).
     */
    function getRequiredStake(address nftContract) external view returns (uint256) {
        return _calculateStakeAmount(nftContract);
    }

    /**
     * @dev Check if a stake is still locked.
     */
    function isLocked(address staker, uint256 agentId) external view returns (bool) {
        Stake memory s = stakes[staker][agentId];
        if (!s.active) return false;
        return block.timestamp < s.unlockAt;
    }

    /**
     * @dev Get remaining lock time in seconds (0 if unlocked or no stake).
     */
    function remainingLockTime(address staker, uint256 agentId) external view returns (uint256) {
        Stake memory s = stakes[staker][agentId];
        if (!s.active || block.timestamp >= s.unlockAt) return 0;
        return s.unlockAt - block.timestamp;
    }

    /**
     * @dev Get all agent IDs staked by an address.
     */
    function getStakerAgents(address staker) external view returns (uint256[] memory) {
        return _stakerAgents[staker];
    }

    /**
     * @dev Get full stake details.
     */
    function getStakeInfo(address staker, uint256 agentId) external view returns (
        uint256 amount,
        uint256 stakedAt,
        uint256 unlockAt,
        address nftUsed,
        uint256 nftTokenId,
        bool active
    ) {
        Stake memory s = stakes[staker][agentId];
        return (s.amount, s.stakedAt, s.unlockAt, s.nftUsed, s.nftTokenId, s.active);
    }

    // ========== Admin Functions ==========

    /**
     * @dev Add or remove an NFT collection from the Ape Tier (50% discount).
     *      Intended for BAYC, MAYC, and similar ape-themed collections.
     */
    function setApeTier(address nftContract, bool eligible) external onlyOwner {
        require(nftContract != address(0), "AgentStaking: zero address");
        // Cannot be in both tiers
        if (eligible) {
            isBluechipTier[nftContract] = false;
        }
        isApeTier[nftContract] = eligible;
        emit ApeTierUpdated(nftContract, eligible);
    }

    /**
     * @dev Add or remove an NFT collection from the Bluechip Tier (25% discount).
     *      Intended for CryptoPunks, Azuki, Doodles, etc.
     */
    function setBluechipTier(address nftContract, bool eligible) external onlyOwner {
        require(nftContract != address(0), "AgentStaking: zero address");
        // Cannot be in both tiers
        if (eligible) {
            isApeTier[nftContract] = false;
        }
        isBluechipTier[nftContract] = eligible;
        emit BluechipTierUpdated(nftContract, eligible);
    }

    /**
     * @dev Emergency unstake by owner (bypasses lock period).
     *      Only for critical situations.
     */
    function emergencyUnstake(address staker, uint256 agentId) external onlyOwner {
        Stake storage s = stakes[staker][agentId];
        require(s.active, "AgentStaking: no active stake");

        uint256 amount = s.amount;
        s.active = false;
        s.amount = 0;
        agentRegistered[agentId] = false;
        totalActiveStakes--;
        totalStakedAmount -= amount;

        require(
            bbaiToken.transfer(staker, amount),
            "AgentStaking: emergency transfer failed"
        );

        emit EmergencyUnstake(staker, agentId, amount);
    }

    /**
     * @dev Pause staking (new stakes blocked, unstaking still works).
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause staking.
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
