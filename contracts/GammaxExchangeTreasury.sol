// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

pragma experimental ABIEncoderV2;

contract GammaxExchangeTreasury is Ownable {
    using SafeERC20 for IERC20;

    event ReceiveEther(address sender, uint256 amount);
    event Claimed(
        address indexed to,
        bool isETH,
        address currency,
        uint256 amount
    );
    event TransferToCounterParty(bool isETH, address currency, uint256 amount);
    event Paused();
    event Unpaused();
    event NewCounterParty(address oldCounterParty, address newCounterParty);
    event AddCurrency(address indexed currency);
    event RemoveCurrency(address indexed currency);

    bool public paused;
    address payable public counterParty;
    mapping(address => bool) public supportCurrency;
    mapping(uint256 => uint256) public claimHistory;

    modifier notPaused() {
        require(!paused, "paused");
        _;
    }

    constructor(address payable counterParty_) {
        paused = false;
        counterParty = counterParty_;
    }

    // This function is called for plain Ether transfers
    receive() external payable {
        if (msg.value > 0) {
            emit ReceiveEther(msg.sender, msg.value);
        }
    }

    function _transfer(
        address payable to,
        bool isETH,
        address currency,
        uint256 amount
    ) internal {
        if (isETH) {
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

    function transferToCounterParty(
        bool isETH,
        address currency,
        uint256 amount
    ) external onlyOwner {
        _transfer(counterParty, isETH, currency, amount);
        emit TransferToCounterParty(isETH, currency, amount);
    }

    function claim(
        address payable to,
        bool isETH,
        address currency,
        uint256 amount
    ) external onlyOwner notPaused {
        require(isETH || supportCurrency[currency], "currency not support");

        _transfer(to, isETH, currency, amount);
        emit Claimed(to, isETH, currency, amount);
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
