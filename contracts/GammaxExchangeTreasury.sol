// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

pragma experimental ABIEncoderV2;

contract GammaxExchangeTreasury is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    event Claimed(address indexed to, address currency, uint256 amount);
    event Deposited(address indexed from, address currency, uint256 amount);
    event TransferToCounterParty(address currency, uint256 amount);
    event Paused();
    event Unpaused();
    event NewCounterParty(address oldCounterParty, address newCounterParty);
    event AddCurrency(address indexed currency);
    event RemoveCurrency(address indexed currency);

    bool public paused;
    address constant ethAddress = 0x0000000000000000000000000000000000000000;
    address payable public counterParty;
    mapping(address => bool) public supportCurrency;
    mapping(uint256 => uint256) public claimHistory;
    mapping(address => mapping(address => uint256)) public userBalance;

    modifier notPaused() {
        require(!paused, "paused");
        _;
    }

    constructor(address payable counterParty_) {
        paused = false;
        counterParty = counterParty_;
        supportCurrency[ethAddress] = true;
    }

    // This function is called for plain Ether transfers
    // receive() external payable {
    //     if (msg.value > 0) {
    //         userBalance[msg.sender][ethAddress] += msg.value;
    //     }
    // }

    function _transfer(
        address payable to,
        address currency,
        uint256 amount
    ) internal {
        if (currency == ethAddress) {
            require(
                address(this).balance >= amount,
                "not enough ether balance"
            );
            require(to.send(amount), "ether transfer failed");
        } else {
            IERC20 token = IERC20(currency);
            uint256 balance = token.balanceOf(address(this));
            require(balance >= amount, "not enough currency balance");
            token.safeTransfer(to, amount);
        }
    }

    function transferToCounterParty(address currency, uint256 amount)
        external
        onlyOwner
    {
        _transfer(counterParty, currency, amount);
        emit TransferToCounterParty(currency, amount);
    }

    function deposit(address currency, uint256 amount)
        public
        payable
        nonReentrant
    {
        require(supportCurrency[currency], "currency not support");
        if (currency == ethAddress) {
            require(msg.value == amount, "the amount should be the same.");
        } else {
            IERC20 token = IERC20(currency);
            token.safeTransferFrom(msg.sender, address(this), amount);
        }
        userBalance[msg.sender][currency] += amount;

        emit Deposited(msg.sender, currency, amount);
    }

    function claim(
        address payable to,
        address currency,
        uint256 amount
    ) external onlyOwner notPaused nonReentrant {
        require(supportCurrency[currency], "currency not support");
        require(userBalance[to][currency] > amount, "insuffcient fund");
        userBalance[to][currency] -= amount;

        _transfer(to, currency, amount);
        emit Claimed(to, currency, amount);
    }

    function _pause() external onlyOwner {
        paused = true;
        emit Paused();
    }

    function _unpause() external onlyOwner {
        paused = false;
        emit Unpaused();
    }

    function _setCounterParty(address payable newCounterParty)
        external
        onlyOwner
    {
        address payable oldCounterParty = counterParty;
        counterParty = newCounterParty;
        emit NewCounterParty(oldCounterParty, newCounterParty);
    }

    function _addCurrency(address currency) external onlyOwner {
        supportCurrency[currency] = true;
        emit AddCurrency(currency);
    }

    function _removeCurrency(address currency) external onlyOwner {
        delete supportCurrency[currency];
        emit RemoveCurrency(currency);
    }
}
