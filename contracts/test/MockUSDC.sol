// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Local test token only. Never deploy this as real USDC.
contract MockUSDC is ERC20 {
    mapping(address => bool) public blocked;
    bool public feeEnabled;
    address public callbackTarget;
    bytes public callbackData;
    bool public callbackSucceeded;
    constructor() ERC20("Mock USDC", "USDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function setBlocked(address who, bool value) external { blocked[who] = value; }
    function setFee(bool value) external { feeEnabled = value; }
    function setCallback(address target, bytes calldata data) external { callbackTarget = target; callbackData = data; }
    function _update(address from, address to, uint256 amount) internal override {
        require(!blocked[from] && !blocked[to], "blocked");
        if (callbackTarget != address(0)) {
            address target = callbackTarget;
            callbackTarget = address(0);
            (callbackSucceeded,) = target.call(callbackData);
        }
        if (feeEnabled && from != address(0) && amount > 0) {
            super._update(from, to, amount - 1);
            super._update(from, address(0), 1);
        } else super._update(from, to, amount);
    }
}
