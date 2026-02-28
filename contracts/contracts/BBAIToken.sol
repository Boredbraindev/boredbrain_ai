// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BBAIToken
 * @dev $BBAI - The native token of the BoredBrain AI Agent Economy
 *
 * Total Supply: 1,000,000,000 BBAI
 *
 * Token Distribution:
 * - 40% Ecosystem Rewards (agent usage, arena prizes)
 * - 20% Team/Development (2-year vesting)
 * - 15% Liquidity (DEX LP, exchange listings)
 * - 15% Community (airdrops, campaigns)
 * - 10% Investors (seed/presale)
 */
contract BBAIToken is ERC20, ERC20Burnable, Ownable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18; // 1 billion BBAI

    event TokensMinted(address indexed to, uint256 amount);

    constructor(address initialOwner) ERC20("BoredBrain AI", "BBAI") Ownable(initialOwner) {
        // Mint initial supply to owner for distribution
        _mint(initialOwner, MAX_SUPPLY);
    }

    /**
     * @dev Returns the number of decimals (18)
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
