// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PaymentRouter
 * @dev Routes $BBAI payments for AI agent API queries.
 *
 * When an AI agent calls a tool through the BoredBrain API:
 * 1. The caller pays in $BBAI
 * 2. 85% goes to the agent owner
 * 3. 15% goes to the platform (fee)
 *
 * This generates on-chain transaction activity for every API call.
 */
contract PaymentRouter is Ownable, ReentrancyGuard {
    IERC20 public bbaiToken;

    uint256 public platformFeePercent = 15; // 15% platform fee
    uint256 public constant MAX_FEE_PERCENT = 30;

    // Track metrics for exchange listing
    uint256 public totalPayments;
    uint256 public totalVolume;
    uint256 public totalPlatformFees;
    uint256 public uniqueCallers;

    mapping(address => bool) private _knownCallers;
    mapping(address => uint256) public pendingWithdrawals;

    // Batch payment tracking
    struct BatchPayment {
        uint256 agentTokenId;
        address agentOwner;
        string toolName;
        uint256 amount;
        uint256 timestamp;
    }

    event QueryPaid(
        uint256 indexed agentTokenId,
        address indexed caller,
        address indexed agentOwner,
        string toolName,
        uint256 amount,
        uint256 platformFee,
        uint256 agentPayment,
        uint256 timestamp
    );

    event BatchPaymentProcessed(
        address indexed caller,
        uint256 totalAmount,
        uint256 paymentCount,
        uint256 timestamp
    );

    event ArenaResultRecorded(
        uint256 indexed matchId,
        uint256 indexed winnerTokenId,
        uint256 prizeAmount,
        uint256 timestamp
    );

    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeesWithdrawn(address indexed to, uint256 amount);

    constructor(
        address initialOwner,
        address _bbaiToken
    ) Ownable(initialOwner) {
        bbaiToken = IERC20(_bbaiToken);
    }

    /**
     * @dev Pay for a single tool query. Splits payment between agent owner and platform.
     */
    function payForQuery(
        uint256 agentTokenId,
        address agentOwner,
        string calldata toolName,
        uint256 amount
    ) external nonReentrant {
        require(amount > 0, "PaymentRouter: amount must be > 0");
        require(agentOwner != address(0), "PaymentRouter: invalid agent owner");

        // Transfer BBAI from caller
        require(
            bbaiToken.transferFrom(msg.sender, address(this), amount),
            "PaymentRouter: transfer failed"
        );

        // Calculate fee split
        uint256 platformFee = (amount * platformFeePercent) / 100;
        uint256 agentPayment = amount - platformFee;

        // Credit agent owner (pull pattern for safety)
        pendingWithdrawals[agentOwner] += agentPayment;
        totalPendingWithdrawals += agentPayment;

        // Track metrics
        totalPayments++;
        totalVolume += amount;
        totalPlatformFees += platformFee;

        if (!_knownCallers[msg.sender]) {
            _knownCallers[msg.sender] = true;
            uniqueCallers++;
        }

        emit QueryPaid(
            agentTokenId,
            msg.sender,
            agentOwner,
            toolName,
            amount,
            platformFee,
            agentPayment,
            block.timestamp
        );
    }

    /**
     * @dev Process a batch of payments in a single transaction.
     * Reduces gas costs for high-volume API usage.
     */
    function batchPayForQueries(
        uint256[] calldata agentTokenIds,
        address[] calldata agentOwners,
        string[] calldata toolNames,
        uint256[] calldata amounts
    ) external nonReentrant {
        uint256 length = agentTokenIds.length;
        require(
            length == agentOwners.length &&
            length == toolNames.length &&
            length == amounts.length,
            "PaymentRouter: array length mismatch"
        );
        require(length > 0 && length <= 50, "PaymentRouter: batch size 1-50");

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < length; i++) {
            totalAmount += amounts[i];
        }

        // Single transfer for entire batch
        require(
            bbaiToken.transferFrom(msg.sender, address(this), totalAmount),
            "PaymentRouter: batch transfer failed"
        );

        // Process each payment
        for (uint256 i = 0; i < length; i++) {
            uint256 platformFee = (amounts[i] * platformFeePercent) / 100;
            uint256 agentPayment = amounts[i] - platformFee;

            pendingWithdrawals[agentOwners[i]] += agentPayment;
            totalPendingWithdrawals += agentPayment;
            totalPlatformFees += platformFee;

            emit QueryPaid(
                agentTokenIds[i],
                msg.sender,
                agentOwners[i],
                toolNames[i],
                amounts[i],
                platformFee,
                agentPayment,
                block.timestamp
            );
        }

        totalPayments += length;
        totalVolume += totalAmount;

        if (!_knownCallers[msg.sender]) {
            _knownCallers[msg.sender] = true;
            uniqueCallers++;
        }

        emit BatchPaymentProcessed(msg.sender, totalAmount, length, block.timestamp);
    }

    /**
     * @dev Record arena match result and distribute prize
     */
    function recordArenaResult(
        uint256 matchId,
        uint256 winnerTokenId,
        address winnerOwner,
        uint256 prizeAmount
    ) external onlyOwner nonReentrant {
        if (prizeAmount > 0) {
            pendingWithdrawals[winnerOwner] += prizeAmount;
            totalPendingWithdrawals += prizeAmount;
        }

        emit ArenaResultRecorded(matchId, winnerTokenId, prizeAmount, block.timestamp);
    }

    /**
     * @dev Agent owners withdraw their earnings
     */
    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "PaymentRouter: nothing to withdraw");

        pendingWithdrawals[msg.sender] = 0;
        totalPendingWithdrawals -= amount;
        require(
            bbaiToken.transfer(msg.sender, amount),
            "PaymentRouter: withdrawal transfer failed"
        );
    }

    /// @notice Running total of all pending agent withdrawals
    uint256 public totalPendingWithdrawals;

    /**
     * @dev Withdraw platform fees only (owner only).
     *      Calculates platform's share as contract balance minus all pending agent withdrawals.
     */
    function withdrawPlatformFees(address to) external onlyOwner {
        require(to != address(0), "PaymentRouter: zero address");
        uint256 contractBalance = bbaiToken.balanceOf(address(this));
        require(contractBalance > totalPendingWithdrawals, "PaymentRouter: no fees");
        uint256 platformBalance = contractBalance - totalPendingWithdrawals;

        require(
            bbaiToken.transfer(to, platformBalance),
            "PaymentRouter: transfer failed"
        );
        emit FeesWithdrawn(to, platformBalance);
    }

    /**
     * @dev Update platform fee percentage (owner only, max 30%)
     */
    function setPlatformFee(uint256 newFeePercent) external onlyOwner {
        require(newFeePercent <= MAX_FEE_PERCENT, "PaymentRouter: fee too high");
        uint256 oldFee = platformFeePercent;
        platformFeePercent = newFeePercent;
        emit PlatformFeeUpdated(oldFee, newFeePercent);
    }

    /**
     * @dev Get platform metrics (for exchange listing dashboard)
     */
    function getMetrics() external view returns (
        uint256 _totalPayments,
        uint256 _totalVolume,
        uint256 _totalPlatformFees,
        uint256 _uniqueCallers
    ) {
        return (totalPayments, totalVolume, totalPlatformFees, uniqueCallers);
    }
}
