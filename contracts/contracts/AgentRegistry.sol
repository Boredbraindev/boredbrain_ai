// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AgentRegistry
 * @dev On-chain registry for AI Agents as ERC-721 NFTs
 *
 * Each registered agent is minted as an NFT with on-chain metadata.
 * Registration requires $BBAI token payment, generating on-chain activity.
 */
contract AgentRegistry is ERC721, ERC721Enumerable, Ownable, ReentrancyGuard {
    using Strings for uint256;

    IERC20 public bbaiToken;

    uint256 private _nextTokenId;
    uint256 public registrationFee = 100 * 10**18; // 100 BBAI to register an agent

    struct AgentInfo {
        string name;
        string description;
        string apiEndpoint;
        string capabilities;   // JSON-encoded string array
        uint256 pricePerQuery; // in BBAI wei
        uint256 totalExecutions;
        uint256 totalRevenue;
        uint256 registeredAt;
        bool active;
    }

    // tokenId => AgentInfo
    mapping(uint256 => AgentInfo) public agents;

    // Track total stats for exchange listing metrics
    uint256 public totalAgentsRegistered;
    uint256 public totalPlatformRevenue;

    event AgentRegistered(
        uint256 indexed tokenId,
        address indexed owner,
        string name,
        string capabilities,
        uint256 pricePerQuery,
        uint256 timestamp
    );

    event AgentUpdated(
        uint256 indexed tokenId,
        string name,
        string apiEndpoint,
        uint256 pricePerQuery
    );

    event AgentDeactivated(uint256 indexed tokenId, uint256 timestamp);
    event AgentActivated(uint256 indexed tokenId, uint256 timestamp);
    event RegistrationFeeUpdated(uint256 oldFee, uint256 newFee);

    constructor(
        address initialOwner,
        address _bbaiToken
    ) ERC721("BoredBrain AI Agent", "BBAI-AGENT") Ownable(initialOwner) {
        bbaiToken = IERC20(_bbaiToken);
    }

    /**
     * @dev Register a new AI agent. Mints an NFT and stores agent metadata.
     * Requires approval of registrationFee amount of BBAI tokens.
     */
    function registerAgent(
        string calldata name,
        string calldata description,
        string calldata apiEndpoint,
        string calldata capabilities,
        uint256 pricePerQuery
    ) external nonReentrant returns (uint256) {
        // Collect registration fee in BBAI
        require(
            bbaiToken.transferFrom(msg.sender, address(this), registrationFee),
            "AgentRegistry: registration fee transfer failed"
        );

        uint256 tokenId = _nextTokenId++;

        // Set agent metadata BEFORE minting (checks-effects-interactions pattern)
        // _safeMint calls onERC721Received which could re-enter

        agents[tokenId] = AgentInfo({
            name: name,
            description: description,
            apiEndpoint: apiEndpoint,
            capabilities: capabilities,
            pricePerQuery: pricePerQuery,
            totalExecutions: 0,
            totalRevenue: 0,
            registeredAt: block.timestamp,
            active: true
        });

        totalAgentsRegistered++;
        totalPlatformRevenue += registrationFee;

        // Mint AFTER state updates (reentrancy protection via CEI + nonReentrant)
        _safeMint(msg.sender, tokenId);

        emit AgentRegistered(tokenId, msg.sender, name, capabilities, pricePerQuery, block.timestamp);

        return tokenId;
    }

    /**
     * @dev Update agent metadata. Only the owner of the agent NFT can update.
     */
    function updateAgent(
        uint256 tokenId,
        string calldata name,
        string calldata description,
        string calldata apiEndpoint,
        string calldata capabilities,
        uint256 pricePerQuery
    ) external {
        require(ownerOf(tokenId) == msg.sender, "AgentRegistry: not agent owner");
        require(agents[tokenId].active, "AgentRegistry: agent not active");

        AgentInfo storage agent = agents[tokenId];
        agent.name = name;
        agent.description = description;
        agent.apiEndpoint = apiEndpoint;
        agent.capabilities = capabilities;
        agent.pricePerQuery = pricePerQuery;

        emit AgentUpdated(tokenId, name, apiEndpoint, pricePerQuery);
    }

    /**
     * @dev Deactivate an agent. Only the owner can deactivate.
     */
    function deactivateAgent(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "AgentRegistry: not agent owner");
        agents[tokenId].active = false;
        emit AgentDeactivated(tokenId, block.timestamp);
    }

    /**
     * @dev Reactivate an agent. Only the owner can reactivate.
     */
    function activateAgent(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "AgentRegistry: not agent owner");
        agents[tokenId].active = true;
        emit AgentActivated(tokenId, block.timestamp);
    }

    /**
     * @dev Record an execution for an agent (called by PaymentRouter)
     */
    function recordExecution(uint256 tokenId, uint256 revenue) external onlyOwner {
        require(agents[tokenId].active, "AgentRegistry: agent not active");
        agents[tokenId].totalExecutions++;
        agents[tokenId].totalRevenue += revenue;
    }

    /**
     * @dev Get agent info
     */
    function getAgent(uint256 tokenId) external view returns (AgentInfo memory) {
        return agents[tokenId];
    }

    /**
     * @dev Update registration fee (owner only)
     */
    function setRegistrationFee(uint256 newFee) external onlyOwner {
        uint256 oldFee = registrationFee;
        registrationFee = newFee;
        emit RegistrationFeeUpdated(oldFee, newFee);
    }

    /**
     * @dev Withdraw collected BBAI fees (owner only)
     */
    function withdrawFees(address to) external onlyOwner {
        require(to != address(0), "AgentRegistry: zero address");
        uint256 balance = bbaiToken.balanceOf(address(this));
        require(balance > 0, "AgentRegistry: no fees to withdraw");
        require(bbaiToken.transfer(to, balance), "AgentRegistry: transfer failed");
    }

    // Required overrides for ERC721Enumerable
    function _update(address to, uint256 tokenId, address auth) internal override(ERC721, ERC721Enumerable) returns (address) {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721Enumerable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
