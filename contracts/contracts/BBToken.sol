// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BBToken
 * @dev $BBAI - The native ERC-20 token of the BoredBrain AI Agent Economy
 *
 * Name: "BoredBrain AI"
 * Symbol: "BBAI"
 * Total Supply: 1,000,000,000 (1 billion) with 18 decimals
 *
 * Features:
 * - Owner mint/burn capabilities
 * - 15% platform fee on agent tool calls (via chargePlatformFee)
 * - 100 BBAI staking lock for agent registration
 * - 1% trade fee on agent token trades (configurable whitelist)
 * - Pausable for emergencies
 *
 * Token Distribution:
 * - 40% Ecosystem Rewards (agent usage, arena prizes)
 * - 20% Team/Development (2-year vesting)
 * - 15% Liquidity (DEX LP, exchange listings)
 * - 15% Community (airdrops, campaigns)
 * - 10% Investors (seed/presale)
 */
contract BBToken is ERC20, ERC20Burnable, ERC20Pausable, Ownable, ReentrancyGuard {

    // ========== Constants ==========

    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18; // 1 billion BBAI
    uint256 public constant PLATFORM_FEE_BPS = 1500;              // 15% = 1500 basis points
    uint256 public constant TRADE_FEE_BPS = 100;                   // 1% = 100 basis points
    uint256 public constant AGENT_STAKE_AMOUNT = 100 * 10**18;     // 100 BBAI
    uint256 public constant STAKE_LOCK_DURATION = 30 days;
    uint256 public constant BPS_DENOMINATOR = 10000;

    // ========== State Variables ==========

    /// @notice Treasury address that receives platform fees and trade fees
    address public treasury;

    /// @notice Whether trade fee is enabled on transfers to/from fee-applicable addresses
    bool public tradeFeeEnabled = true;

    /// @notice Addresses that trigger the 1% trade fee when involved in a transfer
    mapping(address => bool) public isFeeApplicable;

    /// @notice Addresses exempt from trade fees (owner, contracts, etc.)
    mapping(address => bool) public isFeeExempt;

    // ========== Staking ==========

    struct StakeInfo {
        uint256 amount;
        uint256 stakedAt;
        bool active;
    }

    /// @notice Agent registration stakes: staker => agentId => StakeInfo
    mapping(address => mapping(uint256 => StakeInfo)) public stakes;

    /// @notice Total amount currently staked across all agents
    uint256 public totalStaked;

    // ========== Platform Fee Tracking ==========

    /// @notice Total platform fees collected via chargePlatformFee
    uint256 public totalPlatformFeesCollected;

    /// @notice Total trade fees collected via transfer fee
    uint256 public totalTradeFeesCollected;

    // ========== Events ==========

    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event PlatformFeeCharged(address indexed payer, uint256 totalAmount, uint256 feeAmount, uint256 netAmount);
    event TradeFeeCollected(address indexed from, address indexed to, uint256 feeAmount);
    event TradeFeeToggled(bool enabled);
    event FeeApplicableSet(address indexed account, bool applicable);
    event FeeExemptSet(address indexed account, bool exempt);
    event TokensStaked(address indexed staker, uint256 indexed agentId, uint256 amount, uint256 unlockTime);
    event TokensUnstaked(address indexed staker, uint256 indexed agentId, uint256 amount);
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);

    // ========== Constructor ==========

    /**
     * @param initialOwner Address that receives the initial supply and owns the contract
     * @param _treasury Address that receives platform and trade fees
     */
    constructor(
        address initialOwner,
        address _treasury
    ) ERC20("BoredBrain AI", "BBAI") Ownable(initialOwner) {
        require(_treasury != address(0), "BBToken: treasury is zero address");
        treasury = _treasury;

        // Mint full supply to owner for distribution
        _mint(initialOwner, MAX_SUPPLY);

        // Owner and treasury are fee exempt
        isFeeExempt[initialOwner] = true;
        isFeeExempt[_treasury] = true;
    }

    // ========== ERC-20 Overrides ==========

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    /**
     * @dev Override _update to apply trade fees on transfers involving fee-applicable
     *      addresses (e.g. DEX pairs for agent token trades).
     *      The 1% fee is deducted from the transfer amount and sent to treasury.
     */
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Pausable) {
        // Determine if this transfer should incur a trade fee
        if (
            tradeFeeEnabled &&
            from != address(0) &&  // not minting
            to != address(0) &&    // not burning
            !isFeeExempt[from] &&
            !isFeeExempt[to] &&
            (isFeeApplicable[from] || isFeeApplicable[to])
        ) {
            uint256 fee = (amount * TRADE_FEE_BPS) / BPS_DENOMINATOR;
            uint256 netAmount = amount - fee;

            // Transfer fee to treasury
            super._update(from, treasury, fee);
            // Transfer remaining to recipient
            super._update(from, to, netAmount);

            totalTradeFeesCollected += fee;
            emit TradeFeeCollected(from, to, fee);
        } else {
            super._update(from, to, amount);
        }
    }

    // ========== Owner Mint / Burn ==========

    /**
     * @dev Mint new tokens. Cannot exceed MAX_SUPPLY.
     * @param to Recipient address
     * @param amount Amount to mint (in wei)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "BBToken: would exceed max supply");
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    /**
     * @dev Burn tokens from the caller's balance (inherited from ERC20Burnable).
     *      Owner can also burn from any address with allowance.
     */
    function burnFrom(address account, uint256 amount) public override {
        super.burnFrom(account, amount);
        emit TokensBurned(account, amount);
    }

    // ========== Platform Fee (15%) ==========

    /**
     * @dev Charge a 15% platform fee on an agent tool call payment.
     *      The caller must have approved this contract for `totalAmount`.
     *      - 85% goes to the agent owner (recipient)
     *      - 15% goes to the treasury
     *
     * @param payer Address paying for the tool call
     * @param recipient Agent owner receiving the net payment
     * @param totalAmount Total BBAI amount for the tool call
     */
    function chargePlatformFee(
        address payer,
        address recipient,
        uint256 totalAmount
    ) external nonReentrant {
        require(totalAmount > 0, "BBToken: amount must be > 0");
        require(recipient != address(0), "BBToken: recipient is zero address");

        uint256 fee = (totalAmount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        uint256 netAmount = totalAmount - fee;

        // Transfer fee to treasury
        _spendAllowance(payer, msg.sender, totalAmount);
        _transfer(payer, treasury, fee);
        _transfer(payer, recipient, netAmount);

        totalPlatformFeesCollected += fee;
        emit PlatformFeeCharged(payer, totalAmount, fee, netAmount);
    }

    // ========== Staking (100 BBAI for Agent Registration) ==========

    /**
     * @dev Stake 100 BBAI to register an agent. Tokens are locked for 30 days.
     * @param agentId The ID of the agent being registered
     */
    function stakeForAgent(uint256 agentId) external nonReentrant whenNotPaused {
        require(!stakes[msg.sender][agentId].active, "BBToken: already staked for this agent");

        // Transfer stake to this contract
        _transfer(msg.sender, address(this), AGENT_STAKE_AMOUNT);

        stakes[msg.sender][agentId] = StakeInfo({
            amount: AGENT_STAKE_AMOUNT,
            stakedAt: block.timestamp,
            active: true
        });

        totalStaked += AGENT_STAKE_AMOUNT;

        emit TokensStaked(msg.sender, agentId, AGENT_STAKE_AMOUNT, block.timestamp + STAKE_LOCK_DURATION);
    }

    /**
     * @dev Unstake tokens after the 30-day lock period has passed.
     * @param agentId The ID of the agent to unstake from
     */
    function unstakeFromAgent(uint256 agentId) external nonReentrant {
        StakeInfo storage stake = stakes[msg.sender][agentId];
        require(stake.active, "BBToken: no active stake for this agent");
        require(
            block.timestamp >= stake.stakedAt + STAKE_LOCK_DURATION,
            "BBToken: stake still locked (30 days)"
        );

        uint256 amount = stake.amount;
        stake.active = false;
        stake.amount = 0;

        totalStaked -= amount;

        _transfer(address(this), msg.sender, amount);

        emit TokensUnstaked(msg.sender, agentId, amount);
    }

    /**
     * @dev Check if a stake is currently locked
     */
    function isStakeLocked(address staker, uint256 agentId) external view returns (bool) {
        StakeInfo memory stake = stakes[staker][agentId];
        if (!stake.active) return false;
        return block.timestamp < stake.stakedAt + STAKE_LOCK_DURATION;
    }

    /**
     * @dev Get the unlock timestamp for a stake
     */
    function getUnlockTime(address staker, uint256 agentId) external view returns (uint256) {
        StakeInfo memory stake = stakes[staker][agentId];
        require(stake.active, "BBToken: no active stake");
        return stake.stakedAt + STAKE_LOCK_DURATION;
    }

    // ========== Admin Functions ==========

    /**
     * @dev Update the treasury address
     */
    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "BBToken: treasury is zero address");
        address old = treasury;
        treasury = newTreasury;
        isFeeExempt[newTreasury] = true;
        emit TreasuryUpdated(old, newTreasury);
    }

    /**
     * @dev Mark an address as fee-applicable (e.g. DEX pair for agent trades)
     */
    function setFeeApplicable(address account, bool applicable) external onlyOwner {
        isFeeApplicable[account] = applicable;
        emit FeeApplicableSet(account, applicable);
    }

    /**
     * @dev Mark an address as fee-exempt
     */
    function setFeeExempt(address account, bool exempt) external onlyOwner {
        isFeeExempt[account] = exempt;
        emit FeeExemptSet(account, exempt);
    }

    /**
     * @dev Toggle trade fee on/off
     */
    function setTradeFeeEnabled(bool enabled) external onlyOwner {
        tradeFeeEnabled = enabled;
        emit TradeFeeToggled(enabled);
    }

    /**
     * @dev Pause all token transfers (emergency)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause token transfers
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
