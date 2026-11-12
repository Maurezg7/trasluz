// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC — ERC-20 de test (6 decimales) con faucet para la demo en Fuji.
contract MockUSDC is ERC20 {
    uint256 public constant FAUCET_AMOUNT = 100_000 * 1e6;

    constructor() ERC20("Mock USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Cualquiera puede pedir USDC de prueba. Solo testnet.
    function faucet() external {
        _mint(msg.sender, FAUCET_AMOUNT);
    }

    function mint(address to, uint256 amount) external {
        require(amount <= FAUCET_AMOUNT * 10, "limite");
        _mint(to, amount);
    }
}
