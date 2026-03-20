// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BBClawSubscription
 * @notice Pro subscription contract for BoredBrain AI platform.
 *         Accepts 10 USDT (BEP-20) and grants 30-day Pro access.
 */
contract BBClawSubscription is Ownable {
    // ── Constants ────────────────────────────────────────────────────────────
    IERC20 public immutable usdt;
    uint256 public constant SUBSCRIPTION_PRICE = 10 * 1e18; // 10 USDT (18 decimals on BSC)
    uint256 public constant SUBSCRIPTION_DURATION = 30 days;

    // ── State ────────────────────────────────────────────────────────────────
    mapping(address => uint256) public expiresAt;

    // ── Events ───────────────────────────────────────────────────────────────
    event Subscribed(address indexed subscriber, uint256 expiry);
    event Withdrawn(address indexed owner, uint256 amount);

    // ── Constructor ──────────────────────────────────────────────────────────
    constructor(address _usdt) Ownable(msg.sender) {
        usdt = IERC20(_usdt);
    }

    // ── External ─────────────────────────────────────────────────────────────

    /**
     * @notice Subscribe to Pro plan. Caller must have approved >= 10 USDT first.
     *         If already subscribed, the remaining time carries over.
     */
    function subscribe() external {
        require(
            usdt.transferFrom(msg.sender, address(this), SUBSCRIPTION_PRICE),
            "USDT transfer failed"
        );

        uint256 currentExpiry = expiresAt[msg.sender];
        uint256 base = currentExpiry > block.timestamp ? currentExpiry : block.timestamp;
        uint256 newExpiry = base + SUBSCRIPTION_DURATION;

        expiresAt[msg.sender] = newExpiry;

        emit Subscribed(msg.sender, newExpiry);
    }

    /**
     * @notice Check whether a given address has an active subscription.
     */
    function isActive(address _subscriber) external view returns (bool) {
        return expiresAt[_subscriber] > block.timestamp;
    }

    /**
     * @notice Withdraw accumulated USDT to the owner address.
     */
    function withdraw() external onlyOwner {
        uint256 balance = usdt.balanceOf(address(this));
        require(balance > 0, "Nothing to withdraw");
        require(usdt.transfer(owner(), balance), "Withdraw failed");

        emit Withdrawn(owner(), balance);
    }
}
