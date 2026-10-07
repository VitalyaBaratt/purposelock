// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Fixed-purpose USDC escrow. Merchant identity and delivery remain offchain trust assumptions.
/// @dev No owner, upgrades, arbitrary withdrawals, recipient changes, or native-value accounting.
contract PurposeLock is ReentrancyGuard {
    using SafeERC20 for IERC20;
    enum State { Funding, Paid, Refunding }
    struct Campaign {
        address creator;
        address merchant;
        uint64 deadline;
        uint256 goal;
        uint256 raised;
        uint256 refunded;
        bool accepted;
        State state;
        string purpose;
    }

    IERC20 public immutable usdc;
    uint256 public campaignCount;
    // Sum of all campaign funds currently owed by this contract (not unsolicited transfers).
    uint256 public totalEscrowed;
    mapping(uint256 => Campaign) private _campaigns;
    mapping(uint256 => mapping(address => uint256)) public contributions;

    error InvalidCampaign();
    error InvalidTerms();
    error Unauthorized();
    error WrongState();
    error InvalidAmount();
    error TransferMismatch();

    event CampaignCreated(uint256 indexed id, address indexed creator, address indexed merchant, uint256 goal, uint64 deadline, string purpose);
    event MerchantAccepted(uint256 indexed id);
    event Donated(uint256 indexed id, address indexed donor, uint256 amount);
    event MerchantPaid(uint256 indexed id, address indexed merchant, uint256 amount);
    event MerchantRefunded(uint256 indexed id, uint256 amount);
    event DonorRefunded(uint256 indexed id, address indexed donor, uint256 amount);

    constructor(address token) {
        if (token == address(0) || IERC20Metadata(token).decimals() != 6) revert InvalidTerms();
        usdc = IERC20(token);
    }

    function campaign(uint256 id) external view returns (Campaign memory) { return _get(id); }

    /// @notice Creator is the beneficiary of the goods, never the payout recipient.
    function createCampaign(string calldata purpose, uint256 goal, uint64 deadline, address merchant) external returns (uint256 id) {
        if (bytes(purpose).length == 0 || bytes(purpose).length > 240 || goal == 0 ||
            deadline <= block.timestamp || deadline > block.timestamp + 365 days ||
            merchant == address(0) || merchant == msg.sender || merchant == address(this) || merchant == address(usdc)) revert InvalidTerms();
        id = ++campaignCount;
        _campaigns[id] = Campaign(msg.sender, merchant, deadline, goal, 0, 0, false, State.Funding, purpose);
        emit CampaignCreated(id, msg.sender, merchant, goal, deadline, purpose);
    }

    /// @notice Merchant signs acceptance of fixed campaign terms before any donation.
    function acceptMerchant(uint256 id) external {
        Campaign storage c = _get(id);
        if (msg.sender != c.merchant) revert Unauthorized();
        if (c.accepted || c.state != State.Funding || block.timestamp >= c.deadline) revert WrongState();
        c.accepted = true;
        emit MerchantAccepted(id);
    }

    function donate(uint256 id, uint256 amount) external nonReentrant {
        Campaign storage c = _get(id);
        if (c.state != State.Funding || !c.accepted || block.timestamp >= c.deadline) revert WrongState();
        if (amount == 0 || amount > c.goal - c.raised) revert InvalidAmount();
        c.raised += amount;
        contributions[id][msg.sender] += amount;
        totalEscrowed += amount;
        _pullExact(msg.sender, amount);
        emit Donated(id, msg.sender, amount);
    }

    /// @notice Anyone may trigger settlement, but can never choose its recipient.
    function payMerchant(uint256 id) external nonReentrant {
        Campaign storage c = _get(id);
        if (c.state != State.Funding || c.raised != c.goal) revert WrongState();
        c.state = State.Paid;
        totalEscrowed -= c.raised;
        usdc.safeTransfer(c.merchant, c.raised);
        emit MerchantPaid(id, c.merchant, c.raised);
    }

    /// @notice Full merchant refund only in MVP; requires exact approval then pulls into escrow.
    /// @dev Merchant must retain enough additional USDC for Arc gas.
    function merchantRefund(uint256 id) external nonReentrant {
        Campaign storage c = _get(id);
        if (msg.sender != c.merchant) revert Unauthorized();
        if (c.state != State.Paid) revert WrongState();
        c.state = State.Refunding;
        totalEscrowed += c.raised;
        _pullExact(msg.sender, c.raised);
        emit MerchantRefunded(id, c.raised);
    }

    /// @notice Only caller's original contribution is returned, always to the caller.
    function claimRefund(uint256 id) external nonReentrant {
        Campaign storage c = _get(id);
        if (c.state == State.Funding && block.timestamp >= c.deadline && c.raised < c.goal) {
            c.state = State.Refunding;
        }
        if (c.state != State.Refunding) revert WrongState();
        uint256 amount = contributions[id][msg.sender];
        if (amount == 0) revert InvalidAmount();
        contributions[id][msg.sender] = 0;
        c.refunded += amount;
        totalEscrowed -= amount;
        usdc.safeTransfer(msg.sender, amount);
        emit DonorRefunded(id, msg.sender, amount);
    }

    function _get(uint256 id) private view returns (Campaign storage c) {
        if (id == 0 || id > campaignCount) revert InvalidCampaign();
        return _campaigns[id];
    }

    function _pullExact(address from, uint256 amount) private {
        uint256 beforeBalance = usdc.balanceOf(address(this));
        usdc.safeTransferFrom(from, address(this), amount);
        if (usdc.balanceOf(address(this)) != beforeBalance + amount) revert TransferMismatch();
    }
}
