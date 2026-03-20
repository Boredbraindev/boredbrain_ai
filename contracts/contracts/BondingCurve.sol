// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BondingCurve
 * @dev Agent tokenization with linear bonding curve price discovery.
 *
 * Each AI agent gets a unique tokenId. Users buy/sell agent tokens with $BBAI.
 * Price follows a linear bonding curve: price = basePrice + (supply * slope)
 *
 * Fee structure:
 *   - 1% platform trade fee   -> treasury
 *   - 5% creator royalty       -> agent creator
 *
 * The contract mints virtual agent tokens tracked internally (not separate ERC-20s).
 * All payments are in BBAI (the platform ERC-20 token).
 */
contract BondingCurve is Ownable, Pausable, ReentrancyGuard {

    // ========== Constants ==========

    uint256 public constant PLATFORM_FEE_BPS = 100;   // 1%
    uint256 public constant CREATOR_FEE_BPS = 500;    // 5%
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant PRICE_PRECISION = 1e18;

    // ========== State Variables ==========

    /// @notice The BBAI ERC-20 token used for all payments
    IERC20 public immutable bbaiToken;

    /// @notice Platform treasury receiving the 1% trade fee
    address public treasury;

    /// @notice Auto-incrementing token ID counter
    uint256 public nextTokenId;

    // ========== Agent Token Data ==========

    struct AgentTokenInfo {
        address creator;          // Agent owner / creator
        string  name;             // e.g. "ResearchBot Token"
        string  symbol;           // e.g. "RBT"
        uint256 basePrice;        // Starting price (wei of BBAI per token)
        uint256 slope;            // Price increase per 1 token of supply (wei)
        uint256 totalSupply;      // Current circulating supply (18 decimals)
        uint256 maxSupply;        // Hard cap (0 = unlimited)
        bool    active;           // Whether trading is enabled
    }

    /// @notice tokenId => AgentTokenInfo
    mapping(uint256 => AgentTokenInfo) public agentTokens;

    /// @notice tokenId => (holder => balance)
    mapping(uint256 => mapping(address => uint256)) public balanceOf;

    /// @notice tokenId => holder count (simple tracker, increments on first buy)
    mapping(uint256 => uint256) public holderCount;

    /// @notice tokenId => (address => bool) whether address has ever held tokens
    mapping(uint256 => mapping(address => bool)) private _hasHeld;

    /// @notice Total BBAI volume traded across all agent tokens
    uint256 public totalVolumeTraded;

    /// @notice Total platform fees collected
    uint256 public totalPlatformFees;

    /// @notice Total creator fees collected
    uint256 public totalCreatorFees;

    /// @notice Addresses authorized to create agent tokens (e.g. AgentRegistry)
    mapping(address => bool) public isTokenCreator;

    // ========== Events ==========

    event AgentTokenCreated(
        uint256 indexed tokenId,
        address indexed creator,
        string  name,
        string  symbol,
        uint256 basePrice,
        uint256 slope,
        uint256 maxSupply
    );

    event TokensBought(
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 amount,
        uint256 totalCost,
        uint256 platformFee,
        uint256 creatorFee,
        uint256 newSupply,
        uint256 newPrice
    );

    event TokensSold(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 amount,
        uint256 totalPayout,
        uint256 platformFee,
        uint256 creatorFee,
        uint256 newSupply,
        uint256 newPrice
    );

    event AgentTokenPaused(uint256 indexed tokenId);
    event AgentTokenUnpaused(uint256 indexed tokenId);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event TokenCreatorSet(address indexed account, bool authorized);

    // ========== Constructor ==========

    /**
     * @param _bbaiToken   Address of the BBAI ERC-20 token
     * @param _treasury    Platform treasury address
     * @param initialOwner Contract owner (can pause, update treasury)
     */
    constructor(
        address _bbaiToken,
        address _treasury,
        address initialOwner
    ) Ownable(initialOwner) {
        require(_bbaiToken != address(0), "BondingCurve: zero bbai address");
        require(_treasury != address(0), "BondingCurve: zero treasury");

        bbaiToken = IERC20(_bbaiToken);
        treasury = _treasury;
    }

    // ========== View Functions ==========

    /**
     * @dev Get the current spot price for a given agent token.
     *      price = basePrice + (totalSupply * slope)
     *      Supply is in 18-decimal units; slope is wei-per-whole-token so we
     *      divide by 1e18 to keep the math consistent.
     */
    function getCurrentPrice(uint256 tokenId) public view returns (uint256) {
        AgentTokenInfo storage info = agentTokens[tokenId];
        return info.basePrice + (info.totalSupply * info.slope / PRICE_PRECISION);
    }

    /**
     * @dev Calculate the total BBAI cost to buy `amount` tokens (before fees).
     *      Uses the integral of the linear curve: area under the line from
     *      currentSupply to currentSupply + amount.
     *
     *      cost = amount * basePrice + slope * (amount * (2*S + amount) / 2) / 1e18
     *      where S = current totalSupply
     */
    function calculateBuyCost(uint256 tokenId, uint256 amount) public view returns (uint256) {
        AgentTokenInfo storage info = agentTokens[tokenId];
        uint256 s = info.totalSupply;

        // Base component: amount * basePrice / 1e18  (amount is 18-dec, basePrice is wei)
        uint256 baseCost = (amount * info.basePrice) / PRICE_PRECISION;

        // Slope component: slope * amount * (2S + amount) / (2 * 1e18 * 1e18)
        // We need to be careful with overflow. Break it up:
        //   numerator = slope * amount * (2*S + amount)
        //   denominator = 2 * PRICE_PRECISION * PRICE_PRECISION
        uint256 numerator = info.slope * amount;
        uint256 sumTerm = 2 * s + amount;
        // numerator = numerator * sumTerm / (2 * 1e18 * 1e18)
        uint256 slopeCost = (numerator / PRICE_PRECISION) * sumTerm / (2 * PRICE_PRECISION);

        return baseCost + slopeCost;
    }

    /**
     * @dev Calculate the total BBAI payout for selling `amount` tokens (before fees).
     *      Uses the integral from (currentSupply - amount) to currentSupply.
     */
    function calculateSellPayout(uint256 tokenId, uint256 amount) public view returns (uint256) {
        AgentTokenInfo storage info = agentTokens[tokenId];
        require(amount <= info.totalSupply, "BondingCurve: amount > supply");

        uint256 s = info.totalSupply;

        uint256 basePayout = (amount * info.basePrice) / PRICE_PRECISION;

        // slope component: slope * amount * (2*S - amount) / (2 * 1e18^2)
        uint256 numerator = info.slope * amount;
        uint256 diffTerm = 2 * s - amount;
        uint256 slopePayout = (numerator / PRICE_PRECISION) * diffTerm / (2 * PRICE_PRECISION);

        return basePayout + slopePayout;
    }

    /**
     * @dev Market cap = currentPrice * totalSupply / 1e18
     */
    function getMarketCap(uint256 tokenId) external view returns (uint256) {
        AgentTokenInfo storage info = agentTokens[tokenId];
        uint256 price = getCurrentPrice(tokenId);
        return (price * info.totalSupply) / PRICE_PRECISION;
    }

    // ========== Agent Token Creation ==========

    /**
     * @dev Create a new agent token with bonding curve parameters.
     *      Only the agent creator (off-chain verified) calls this, or the owner.
     *
     * @param creator   Address of the agent's owner/creator (receives 5% royalties)
     * @param name      Token display name
     * @param symbol    Token ticker symbol
     * @param basePrice Starting price in BBAI wei (e.g. 1e15 = 0.001 BBAI)
     * @param slope     Price slope in BBAI wei per whole token of supply
     * @param maxSupply Max mintable supply (0 = no cap)
     * @return tokenId  The assigned token ID
     */
    function createAgentToken(
        address creator,
        string calldata name,
        string calldata symbol,
        uint256 basePrice,
        uint256 slope,
        uint256 maxSupply
    ) external whenNotPaused returns (uint256 tokenId) {
        require(
            msg.sender == owner() || isTokenCreator[msg.sender],
            "BondingCurve: not authorized to create tokens"
        );
        require(creator != address(0), "BondingCurve: zero creator");
        require(basePrice > 0, "BondingCurve: basePrice must be > 0");
        require(slope > 0, "BondingCurve: slope must be > 0");
        require(bytes(name).length > 0, "BondingCurve: empty name");
        require(bytes(symbol).length > 0, "BondingCurve: empty symbol");

        tokenId = nextTokenId++;

        agentTokens[tokenId] = AgentTokenInfo({
            creator: creator,
            name: name,
            symbol: symbol,
            basePrice: basePrice,
            slope: slope,
            totalSupply: 0,
            maxSupply: maxSupply,
            active: true
        });

        emit AgentTokenCreated(tokenId, creator, name, symbol, basePrice, slope, maxSupply);
    }

    // ========== Buy / Sell ==========

    /**
     * @dev Buy agent tokens by paying BBAI.
     *      The buyer must have approved this contract for sufficient BBAI.
     *
     *      Flow:
     *      1. Calculate raw cost from bonding curve integral
     *      2. Add 1% platform fee + 5% creator fee on top
     *      3. Transfer total BBAI from buyer
     *      4. Mint agent tokens to buyer
     *
     * @param tokenId Agent token ID
     * @param amount  Number of agent tokens to buy (18-decimal)
     * @param maxCost Maximum BBAI the buyer is willing to spend (slippage protection)
     */
    function buy(
        uint256 tokenId,
        uint256 amount,
        uint256 maxCost
    ) external nonReentrant whenNotPaused {
        AgentTokenInfo storage info = agentTokens[tokenId];
        require(info.active, "BondingCurve: token not active");
        require(amount > 0, "BondingCurve: zero amount");
        if (info.maxSupply > 0) {
            require(info.totalSupply + amount <= info.maxSupply, "BondingCurve: exceeds max supply");
        }

        uint256 rawCost = calculateBuyCost(tokenId, amount);
        uint256 platformFee = (rawCost * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        uint256 creatorFee = (rawCost * CREATOR_FEE_BPS) / BPS_DENOMINATOR;
        uint256 totalCost = rawCost + platformFee + creatorFee;

        require(totalCost <= maxCost, "BondingCurve: cost exceeds maxCost");

        // Transfer BBAI from buyer
        require(bbaiToken.transferFrom(msg.sender, address(this), rawCost), "BondingCurve: BBAI transfer failed");
        if (platformFee > 0) {
            require(bbaiToken.transferFrom(msg.sender, treasury, platformFee), "BondingCurve: fee transfer failed");
        }
        if (creatorFee > 0) {
            require(bbaiToken.transferFrom(msg.sender, info.creator, creatorFee), "BondingCurve: creator fee failed");
        }

        // Mint agent tokens
        info.totalSupply += amount;
        balanceOf[tokenId][msg.sender] += amount;

        // Track holders
        if (!_hasHeld[tokenId][msg.sender]) {
            _hasHeld[tokenId][msg.sender] = true;
            holderCount[tokenId]++;
        }

        // Stats
        totalVolumeTraded += totalCost;
        totalPlatformFees += platformFee;
        totalCreatorFees += creatorFee;

        emit TokensBought(
            tokenId,
            msg.sender,
            amount,
            totalCost,
            platformFee,
            creatorFee,
            info.totalSupply,
            getCurrentPrice(tokenId)
        );
    }

    /**
     * @dev Sell agent tokens back to the curve and receive BBAI.
     *
     *      Flow:
     *      1. Calculate raw payout from bonding curve integral
     *      2. Deduct 1% platform fee + 5% creator fee
     *      3. Burn agent tokens from seller
     *      4. Transfer net BBAI to seller
     *
     * @param tokenId  Agent token ID
     * @param amount   Number of agent tokens to sell (18-decimal)
     * @param minPayout Minimum BBAI the seller will accept (slippage protection)
     */
    function sell(
        uint256 tokenId,
        uint256 amount,
        uint256 minPayout
    ) external nonReentrant whenNotPaused {
        AgentTokenInfo storage info = agentTokens[tokenId];
        require(info.active, "BondingCurve: token not active");
        require(amount > 0, "BondingCurve: zero amount");
        require(balanceOf[tokenId][msg.sender] >= amount, "BondingCurve: insufficient balance");

        uint256 rawPayout = calculateSellPayout(tokenId, amount);
        uint256 platformFee = (rawPayout * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        uint256 creatorFee = (rawPayout * CREATOR_FEE_BPS) / BPS_DENOMINATOR;
        uint256 netPayout = rawPayout - platformFee - creatorFee;

        require(netPayout >= minPayout, "BondingCurve: payout below minPayout");

        // Burn agent tokens
        balanceOf[tokenId][msg.sender] -= amount;
        info.totalSupply -= amount;

        // Transfer BBAI
        require(bbaiToken.transfer(msg.sender, netPayout), "BondingCurve: payout transfer failed");
        if (platformFee > 0) {
            require(bbaiToken.transfer(treasury, platformFee), "BondingCurve: fee transfer failed");
        }
        if (creatorFee > 0) {
            require(bbaiToken.transfer(info.creator, creatorFee), "BondingCurve: creator fee failed");
        }

        // Stats
        totalVolumeTraded += rawPayout;
        totalPlatformFees += platformFee;
        totalCreatorFees += creatorFee;

        emit TokensSold(
            tokenId,
            msg.sender,
            amount,
            netPayout,
            platformFee,
            creatorFee,
            info.totalSupply,
            getCurrentPrice(tokenId)
        );
    }

    // ========== Admin ==========

    /**
     * @dev Pause a specific agent token (creator or owner)
     */
    function pauseAgentToken(uint256 tokenId) external {
        AgentTokenInfo storage info = agentTokens[tokenId];
        require(
            msg.sender == info.creator || msg.sender == owner(),
            "BondingCurve: not creator or owner"
        );
        info.active = false;
        emit AgentTokenPaused(tokenId);
    }

    /**
     * @dev Unpause a specific agent token (creator or owner)
     */
    function unpauseAgentToken(uint256 tokenId) external {
        AgentTokenInfo storage info = agentTokens[tokenId];
        require(
            msg.sender == info.creator || msg.sender == owner(),
            "BondingCurve: not creator or owner"
        );
        info.active = true;
        emit AgentTokenUnpaused(tokenId);
    }

    /**
     * @dev Update treasury address
     */
    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "BondingCurve: zero treasury");
        address old = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(old, newTreasury);
    }

    /**
     * @dev Set an address as authorized to create agent tokens
     */
    function setTokenCreator(address account, bool authorized) external onlyOwner {
        require(account != address(0), "BondingCurve: zero address");
        isTokenCreator[account] = authorized;
        emit TokenCreatorSet(account, authorized);
    }

    /**
     * @dev Emergency pause all trading
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause all trading
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Emergency withdraw stuck BBAI (should not happen in normal flow)
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        require(bbaiToken.transfer(treasury, amount), "BondingCurve: withdraw failed");
    }
}
