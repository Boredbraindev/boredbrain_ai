// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PredictionSettlement
 * @notice Records prediction round results on-chain for BoredBrain AI.
 *         Hybrid model: bets happen off-chain (points), settlement is on-chain.
 *         Designed for BSC (mainnet/testnet).
 *
 * @dev Post-TGE: integrate with BBAI token for real payouts.
 *      Pre-TGE:  records round metadata + results as immutable on-chain proofs.
 */
contract PredictionSettlement {
    // ─── Types ────────────────────────────────────────────────────────────────

    enum Direction { UP, DOWN }

    struct Round {
        uint256 roundId;
        string  asset;           // "BTC", "ETH", "SOL"
        uint256 startPrice;      // 8-decimal fixed point (e.g. 6500000000000 = $65,000.00)
        uint256 endPrice;
        Direction outcome;
        uint256 upPool;          // total UP bet volume (points)
        uint256 downPool;        // total DOWN bet volume (points)
        uint256 totalBets;
        uint256 settledAt;       // block.timestamp
        address settledBy;
    }

    // ─── State ────────────────────────────────────────────────────────────────

    address public owner;
    address public operator;     // heartbeat/cron address allowed to settle

    uint256 public totalRounds;
    uint256 public totalVolume;  // cumulative bet volume (points)

    mapping(uint256 => Round) public rounds;
    uint256[] public roundIds;

    // ─── Events ───────────────────────────────────────────────────────────────

    event RoundSettled(
        uint256 indexed roundId,
        string  asset,
        Direction outcome,
        uint256 startPrice,
        uint256 endPrice,
        uint256 upPool,
        uint256 downPool,
        uint256 totalBets,
        uint256 settledAt
    );

    event OperatorUpdated(address indexed oldOperator, address indexed newOperator);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyOperator() {
        require(
            msg.sender == operator || msg.sender == owner,
            "Not operator"
        );
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _operator) {
        owner = msg.sender;
        operator = _operator;
    }

    // ─── Settlement ───────────────────────────────────────────────────────────

    /**
     * @notice Record a completed prediction round on-chain.
     * @param _roundId   Unique round identifier (from off-chain system)
     * @param _asset     Asset symbol ("BTC", "ETH", "SOL")
     * @param _startPrice Start price (8-decimal fixed point)
     * @param _endPrice   End price (8-decimal fixed point)
     * @param _outcome    Result direction (0 = UP, 1 = DOWN)
     * @param _upPool     Total UP bet volume in points
     * @param _downPool   Total DOWN bet volume in points
     * @param _totalBets  Number of individual bets in the round
     */
    function settleRound(
        uint256   _roundId,
        string    calldata _asset,
        uint256   _startPrice,
        uint256   _endPrice,
        Direction _outcome,
        uint256   _upPool,
        uint256   _downPool,
        uint256   _totalBets
    ) external onlyOperator {
        require(rounds[_roundId].settledAt == 0, "Already settled");
        require(_startPrice > 0 && _endPrice > 0, "Invalid prices");

        rounds[_roundId] = Round({
            roundId:    _roundId,
            asset:      _asset,
            startPrice: _startPrice,
            endPrice:   _endPrice,
            outcome:    _outcome,
            upPool:     _upPool,
            downPool:   _downPool,
            totalBets:  _totalBets,
            settledAt:  block.timestamp,
            settledBy:  msg.sender
        });

        roundIds.push(_roundId);
        totalRounds++;
        totalVolume += _upPool + _downPool;

        emit RoundSettled(
            _roundId,
            _asset,
            _outcome,
            _startPrice,
            _endPrice,
            _upPool,
            _downPool,
            _totalBets,
            block.timestamp
        );
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getRound(uint256 _roundId) external view returns (Round memory) {
        require(rounds[_roundId].settledAt > 0, "Round not found");
        return rounds[_roundId];
    }

    function getRecentRounds(uint256 _count) external view returns (Round[] memory) {
        uint256 len = roundIds.length;
        uint256 count = _count > len ? len : _count;
        Round[] memory result = new Round[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = rounds[roundIds[len - 1 - i]];
        }
        return result;
    }

    function getRoundCount() external view returns (uint256) {
        return roundIds.length;
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setOperator(address _operator) external onlyOwner {
        emit OperatorUpdated(operator, _operator);
        operator = _operator;
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Zero address");
        emit OwnershipTransferred(owner, _newOwner);
        owner = _newOwner;
    }
}
