// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title AgentRegistry8004
 * @dev ERC-8004 compliant on-chain agent registry for BNB Chain.
 *
 * Implements the ERC-8004 standard for on-chain AI agent registration,
 * enabling discoverability, metadata storage, and interoperability
 * across the BNB Chain agent ecosystem.
 *
 * Each agent receives a unique uint256 ID and stores:
 * - name, description, endpoint URL, agentCardUrl
 * - tools list (string array encoded as comma-separated string)
 * - owner address
 *
 * Registration requires BBAI staking via the AgentStaking contract.
 * Deregistration returns staked tokens after the lock period.
 *
 * Compatible with:
 * - BNB Chain ERC-8004 agent registry standard
 * - BoredBrain BBAI token economy (100 BBAI staking requirement)
 * - AgentStaking contract for NFT-tier discounted staking
 */
contract AgentRegistry8004 is Ownable, ReentrancyGuard, Pausable {

    // ========== Structs ==========

    struct AgentMetadata {
        string name;
        string description;
        string endpointUrl;
        string agentCardUrl;
        string tools;           // Comma-separated list of tool identifiers
        address owner;
        uint256 registeredAt;
        uint256 updatedAt;
        bool active;
    }

    // ========== State Variables ==========

    /// @notice The BBAI token contract used for staking
    IERC20 public immutable bbaiToken;

    /// @notice The AgentStaking contract address (optional, for delegated staking)
    address public stakingContract;

    /// @notice Required stake amount for registration (100 BBAI default)
    uint256 public stakeRequirement = 100 * 10**18;

    /// @notice Lock duration for staked tokens
    uint256 public constant LOCK_DURATION = 30 days;

    /// @notice Auto-incrementing agent ID counter
    uint256 private _nextAgentId = 1;

    /// @notice Total number of registered (active) agents
    uint256 public activeAgentCount;

    /// @notice Total agents ever registered (including deregistered)
    uint256 public totalAgentsRegistered;

    /// @notice Total BBAI currently staked through this registry
    uint256 public totalStaked;

    // ========== Mappings ==========

    /// @notice Agent ID => Agent metadata
    mapping(uint256 => AgentMetadata) private _agents;

    /// @notice Agent ID => staked amount
    mapping(uint256 => uint256) public agentStake;

    /// @notice Agent ID => stake timestamp (for lock period)
    mapping(uint256 => uint256) public agentStakedAt;

    /// @notice Owner address => list of agent IDs
    mapping(address => uint256[]) private _ownerAgents;

    /// @notice Agent ID => index in the owner's agent array (for efficient removal)
    mapping(uint256 => uint256) private _ownerAgentIndex;

    /// @notice Endpoint URL hash => agent ID (prevent duplicate endpoints)
    mapping(bytes32 => uint256) private _endpointToAgent;

    // ========== Events ==========

    event AgentRegistered(
        uint256 indexed agentId,
        address indexed owner,
        string name,
        string endpointUrl,
        string agentCardUrl,
        string tools,
        uint256 stakedAmount,
        uint256 timestamp
    );

    event AgentUpdated(
        uint256 indexed agentId,
        address indexed owner,
        string name,
        string endpointUrl,
        string agentCardUrl,
        string tools,
        uint256 timestamp
    );

    event AgentDeregistered(
        uint256 indexed agentId,
        address indexed owner,
        uint256 stakedReturned,
        uint256 timestamp
    );

    event StakeRequirementUpdated(uint256 oldAmount, uint256 newAmount);
    event StakingContractUpdated(address oldContract, address newContract);

    // ========== Constructor ==========

    /**
     * @param _bbaiToken Address of the BBAI ERC-20 token
     * @param _stakingContract Address of the AgentStaking contract (can be address(0) for direct staking)
     * @param initialOwner Owner of this registry contract
     */
    constructor(
        address _bbaiToken,
        address _stakingContract,
        address initialOwner
    ) Ownable(initialOwner) {
        require(_bbaiToken != address(0), "ERC8004: token is zero address");
        bbaiToken = IERC20(_bbaiToken);
        stakingContract = _stakingContract;
    }

    // ========== Modifiers ==========

    modifier onlyAgentOwner(uint256 agentId) {
        require(_agents[agentId].owner == msg.sender, "ERC8004: not agent owner");
        require(_agents[agentId].active, "ERC8004: agent not active");
        _;
    }

    // ========== Registration ==========

    /**
     * @dev Register a new agent on-chain following ERC-8004.
     *      Caller must have approved this contract for `stakeRequirement` BBAI tokens.
     *
     * @param name Human-readable agent name
     * @param description Agent description / purpose
     * @param endpointUrl URL where the agent can be reached (A2A protocol)
     * @param agentCardUrl URL to the agent's agent-card.json
     * @param tools Comma-separated list of tool/capability identifiers
     * @return agentId The unique on-chain ID assigned to this agent
     */
    function registerAgent(
        string calldata name,
        string calldata description,
        string calldata endpointUrl,
        string calldata agentCardUrl,
        string calldata tools
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(bytes(name).length > 0 && bytes(name).length <= 128, "ERC8004: invalid name length");
        require(bytes(description).length <= 2000, "ERC8004: description too long");
        require(bytes(endpointUrl).length > 0, "ERC8004: endpoint required");
        require(bytes(endpointUrl).length <= 500, "ERC8004: endpoint too long");
        require(bytes(agentCardUrl).length <= 500, "ERC8004: agentCardUrl too long");

        // Ensure endpoint uniqueness
        bytes32 endpointHash = keccak256(bytes(endpointUrl));
        require(
            _endpointToAgent[endpointHash] == 0 || !_agents[_endpointToAgent[endpointHash]].active,
            "ERC8004: endpoint already registered"
        );

        // Transfer staking tokens from caller
        require(
            bbaiToken.transferFrom(msg.sender, address(this), stakeRequirement),
            "ERC8004: stake transfer failed"
        );

        uint256 agentId = _nextAgentId++;

        _agents[agentId] = AgentMetadata({
            name: name,
            description: description,
            endpointUrl: endpointUrl,
            agentCardUrl: agentCardUrl,
            tools: tools,
            owner: msg.sender,
            registeredAt: block.timestamp,
            updatedAt: block.timestamp,
            active: true
        });

        agentStake[agentId] = stakeRequirement;
        agentStakedAt[agentId] = block.timestamp;
        totalStaked += stakeRequirement;

        // Track endpoint uniqueness
        _endpointToAgent[endpointHash] = agentId;

        // Track owner's agents
        _ownerAgentIndex[agentId] = _ownerAgents[msg.sender].length;
        _ownerAgents[msg.sender].push(agentId);

        activeAgentCount++;
        totalAgentsRegistered++;

        emit AgentRegistered(
            agentId,
            msg.sender,
            name,
            endpointUrl,
            agentCardUrl,
            tools,
            stakeRequirement,
            block.timestamp
        );

        return agentId;
    }

    // ========== Update ==========

    /**
     * @dev Update agent metadata. Only the agent owner can update.
     *
     * @param agentId The on-chain agent ID
     * @param name Updated name (pass empty string to keep existing)
     * @param description Updated description
     * @param endpointUrl Updated endpoint URL
     * @param agentCardUrl Updated agent card URL
     * @param tools Updated tools list (comma-separated)
     */
    function updateAgent(
        uint256 agentId,
        string calldata name,
        string calldata description,
        string calldata endpointUrl,
        string calldata agentCardUrl,
        string calldata tools
    ) external onlyAgentOwner(agentId) {
        AgentMetadata storage agent = _agents[agentId];

        // Update name if provided
        if (bytes(name).length > 0) {
            require(bytes(name).length <= 128, "ERC8004: invalid name length");
            agent.name = name;
        }

        // Update description
        if (bytes(description).length > 0) {
            require(bytes(description).length <= 2000, "ERC8004: description too long");
            agent.description = description;
        }

        // Update endpoint (check uniqueness if changed)
        if (bytes(endpointUrl).length > 0) {
            require(bytes(endpointUrl).length <= 500, "ERC8004: endpoint too long");

            bytes32 oldHash = keccak256(bytes(agent.endpointUrl));
            bytes32 newHash = keccak256(bytes(endpointUrl));

            if (oldHash != newHash) {
                require(
                    _endpointToAgent[newHash] == 0 || !_agents[_endpointToAgent[newHash]].active,
                    "ERC8004: endpoint already registered"
                );
                // Clear old endpoint mapping
                delete _endpointToAgent[oldHash];
                _endpointToAgent[newHash] = agentId;
            }

            agent.endpointUrl = endpointUrl;
        }

        // Update agent card URL
        if (bytes(agentCardUrl).length > 0) {
            require(bytes(agentCardUrl).length <= 500, "ERC8004: agentCardUrl too long");
            agent.agentCardUrl = agentCardUrl;
        }

        // Update tools
        if (bytes(tools).length > 0) {
            agent.tools = tools;
        }

        agent.updatedAt = block.timestamp;

        emit AgentUpdated(
            agentId,
            msg.sender,
            agent.name,
            agent.endpointUrl,
            agent.agentCardUrl,
            agent.tools,
            block.timestamp
        );
    }

    // ========== Deregistration ==========

    /**
     * @dev Deregister an agent and return staked tokens.
     *      Staked tokens are only returned if the 30-day lock period has elapsed.
     *      If called before lock expiry, the agent is deactivated but tokens remain locked
     *      until the owner calls claimStake().
     *
     * @param agentId The on-chain agent ID to deregister
     */
    function deregisterAgent(uint256 agentId) external nonReentrant onlyAgentOwner(agentId) {
        AgentMetadata storage agent = _agents[agentId];
        agent.active = false;
        agent.updatedAt = block.timestamp;

        // Clear endpoint mapping
        bytes32 endpointHash = keccak256(bytes(agent.endpointUrl));
        delete _endpointToAgent[endpointHash];

        // Remove from owner's agent list (swap-and-pop)
        _removeFromOwnerList(msg.sender, agentId);

        activeAgentCount--;

        uint256 stakedAmount = agentStake[agentId];
        uint256 returnedAmount = 0;

        // Return stake if lock period has passed
        if (stakedAmount > 0 && block.timestamp >= agentStakedAt[agentId] + LOCK_DURATION) {
            agentStake[agentId] = 0;
            totalStaked -= stakedAmount;
            returnedAmount = stakedAmount;

            require(
                bbaiToken.transfer(msg.sender, stakedAmount),
                "ERC8004: stake return failed"
            );
        }

        emit AgentDeregistered(agentId, msg.sender, returnedAmount, block.timestamp);
    }

    /**
     * @dev Claim staked tokens for a deregistered agent after the lock period.
     *      Use this if deregisterAgent was called before the lock expired.
     *
     * @param agentId The agent ID to claim stake for
     */
    function claimStake(uint256 agentId) external nonReentrant {
        require(_agents[agentId].owner == msg.sender, "ERC8004: not agent owner");
        require(!_agents[agentId].active, "ERC8004: agent still active");

        uint256 stakedAmount = agentStake[agentId];
        require(stakedAmount > 0, "ERC8004: no stake to claim");
        require(
            block.timestamp >= agentStakedAt[agentId] + LOCK_DURATION,
            "ERC8004: stake still locked"
        );

        agentStake[agentId] = 0;
        totalStaked -= stakedAmount;

        require(
            bbaiToken.transfer(msg.sender, stakedAmount),
            "ERC8004: stake return failed"
        );
    }

    // ========== View Functions ==========

    /**
     * @dev Get full agent metadata by ID.
     * @param agentId The on-chain agent ID
     * @return metadata The agent's metadata struct
     */
    function getAgent(uint256 agentId) external view returns (AgentMetadata memory metadata) {
        require(_agents[agentId].registeredAt > 0, "ERC8004: agent does not exist");
        return _agents[agentId];
    }

    /**
     * @dev Get all agent IDs owned by a specific address.
     * @param owner The owner address to query
     * @return agentIds Array of agent IDs owned by the address
     */
    function getAgentsByOwner(address owner) external view returns (uint256[] memory agentIds) {
        return _ownerAgents[owner];
    }

    /**
     * @dev Check if an agent ID is currently registered and active.
     * @param agentId The agent ID to check
     * @return registered Whether the agent is registered and active
     */
    function isRegistered(uint256 agentId) external view returns (bool registered) {
        return _agents[agentId].active;
    }

    /**
     * @dev Get the total number of agents ever registered.
     * @return count Total agents registered (including deregistered)
     */
    function totalAgents() external view returns (uint256 count) {
        return totalAgentsRegistered;
    }

    /**
     * @dev Get the owner of a specific agent.
     * @param agentId The agent ID
     * @return owner The owner address
     */
    function ownerOfAgent(uint256 agentId) external view returns (address) {
        require(_agents[agentId].registeredAt > 0, "ERC8004: agent does not exist");
        return _agents[agentId].owner;
    }

    /**
     * @dev Get the endpoint URL for an agent (primary discovery mechanism).
     * @param agentId The agent ID
     * @return endpointUrl The agent's endpoint URL
     */
    function getEndpoint(uint256 agentId) external view returns (string memory endpointUrl) {
        require(_agents[agentId].active, "ERC8004: agent not active");
        return _agents[agentId].endpointUrl;
    }

    /**
     * @dev Get the agent card URL for an agent.
     * @param agentId The agent ID
     * @return agentCardUrl The agent's card URL
     */
    function getAgentCardUrl(uint256 agentId) external view returns (string memory agentCardUrl) {
        require(_agents[agentId].active, "ERC8004: agent not active");
        return _agents[agentId].agentCardUrl;
    }

    /**
     * @dev Check if the stake for an agent is still within the lock period.
     * @param agentId The agent ID
     * @return locked Whether the stake is locked
     */
    function isStakeLocked(uint256 agentId) external view returns (bool locked) {
        if (agentStake[agentId] == 0) return false;
        return block.timestamp < agentStakedAt[agentId] + LOCK_DURATION;
    }

    /**
     * @dev Get the number of agents owned by an address.
     * @param owner The owner address
     * @return count Number of active agents
     */
    function agentCountByOwner(address owner) external view returns (uint256 count) {
        return _ownerAgents[owner].length;
    }

    // ========== ERC-8004 Interface Support ==========

    /**
     * @dev Returns true if this contract implements the ERC-8004 interface.
     * @param interfaceId The interface identifier (EIP-165)
     * @return supported Whether the interface is supported
     */
    function supportsInterface(bytes4 interfaceId) external pure returns (bool supported) {
        // ERC-8004 interface ID (keccak256 of core function signatures)
        // EIP-165 interface ID
        bytes4 ERC165_ID = 0x01ffc9a7;
        // ERC-8004 interface ID: registerAgent, getAgent, isRegistered, deregisterAgent
        bytes4 ERC8004_ID = bytes4(
            keccak256("registerAgent(string,string,string,string,string)") ^
            keccak256("getAgent(uint256)") ^
            keccak256("isRegistered(uint256)") ^
            keccak256("deregisterAgent(uint256)")
        );
        return interfaceId == ERC165_ID || interfaceId == ERC8004_ID;
    }

    // ========== Admin Functions ==========

    /**
     * @dev Update the required stake amount for registration.
     * @param newAmount New stake requirement in BBAI wei
     */
    function setStakeRequirement(uint256 newAmount) external onlyOwner {
        uint256 oldAmount = stakeRequirement;
        stakeRequirement = newAmount;
        emit StakeRequirementUpdated(oldAmount, newAmount);
    }

    /**
     * @dev Update the staking contract address.
     * @param newContract New AgentStaking contract address
     */
    function setStakingContract(address newContract) external onlyOwner {
        address oldContract = stakingContract;
        stakingContract = newContract;
        emit StakingContractUpdated(oldContract, newContract);
    }

    /**
     * @dev Pause registrations (existing agents remain active).
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause registrations.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Emergency deregister an agent (admin only, bypasses owner check).
     * @param agentId The agent ID to force-deregister
     */
    function emergencyDeregister(uint256 agentId) external onlyOwner {
        require(_agents[agentId].active, "ERC8004: agent not active");

        AgentMetadata storage agent = _agents[agentId];
        address agentOwner = agent.owner;
        agent.active = false;
        agent.updatedAt = block.timestamp;

        bytes32 endpointHash = keccak256(bytes(agent.endpointUrl));
        delete _endpointToAgent[endpointHash];

        _removeFromOwnerList(agentOwner, agentId);
        activeAgentCount--;

        // Return stake to agent owner
        uint256 stakedAmount = agentStake[agentId];
        if (stakedAmount > 0) {
            agentStake[agentId] = 0;
            totalStaked -= stakedAmount;
            require(
                bbaiToken.transfer(agentOwner, stakedAmount),
                "ERC8004: emergency refund failed"
            );
        }

        emit AgentDeregistered(agentId, agentOwner, stakedAmount, block.timestamp);
    }

    // ========== Internal Helpers ==========

    /**
     * @dev Remove an agent ID from the owner's list using swap-and-pop.
     */
    function _removeFromOwnerList(address owner, uint256 agentId) internal {
        uint256[] storage agentIds = _ownerAgents[owner];
        uint256 index = _ownerAgentIndex[agentId];
        uint256 lastIndex = agentIds.length - 1;

        if (index != lastIndex) {
            uint256 lastAgentId = agentIds[lastIndex];
            agentIds[index] = lastAgentId;
            _ownerAgentIndex[lastAgentId] = index;
        }

        agentIds.pop();
        delete _ownerAgentIndex[agentId];
    }
}
