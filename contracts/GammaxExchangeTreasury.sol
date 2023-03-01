// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

pragma experimental ABIEncoderV2;

contract GammaxExchangeTreasury is Ownable,ReentrancyGuard {
    using SafeERC20 for IERC20;

    event Deposited(
        address indexed from,
        address currency,
        uint256 amount
    );
    
    event Withdrawn(
        address indexed to,
        address currency,
        uint256 amount
    );

    event Transferred(
        address indexed from,
        address to,
        address currency,
        uint256 amount
    );

    event Paused();
    event Unpaused();
    event AddCurrency(address indexed currency);
    event RemoveCurrency(address indexed currency);

    bool public paused;
    address constant ethAddress = 0x0000000000000000000000000000000000000000;

    mapping(address => mapping(address => uint256)) private userBalance;
    mapping(address => bool) public supportCurrency;

    constructor() {
        paused = false;
    }

    modifier notPaused() {
        require(!paused, "paused");
        _;
    }

    modifier availableUserBalance(address user, address currency, uint amount){
        require(userBalance[user][currency] >= amount, "Not enough funds for this user");
        _;
    }

    modifier currencySupported(address currency){
        require(supportCurrency[currency], "Currency not supported");
        _;
    }

    function getBalance(address user,address currency) 
        public 
        view 
        returns(uint256)
    {
        return userBalance[user][currency];
    }

    receive() 
        external 
        payable 
        notPaused
        nonReentrant
    {
        uint256 amount = msg.value;
        require(amount > 0, "Not enough funds to deposit");
        address account = msg.sender;
        userBalance[account][ethAddress] += msg.value;
        emit Deposited(account,ethAddress, amount);
    }

    function depositERC20(address from, address user, uint256 amount, address currency) 
        public
        notPaused
        nonReentrant
        currencySupported(currency)
    {
        IERC20(currency).safeTransferFrom(from, address(this), amount);
        userBalance[user][currency] += amount;
        emit Deposited(user,currency, amount);
    }

    function withdrawERC20(address user,uint256 amount,address currency) 
        public 
        notPaused
        nonReentrant
        onlyOwner
        currencySupported(currency)
        availableUserBalance(user,currency,amount)
    {
        require(IERC20(currency).balanceOf(address(this)) >= amount, "Not enough funds in treasury");
        userBalance[user][currency] -= amount;
        IERC20(currency).transfer(user, amount);
        emit Withdrawn(user, currency, amount);
    }

    function withdrawEth(address payable user,uint256 amount)
        public 
        notPaused
        nonReentrant
        availableUserBalance(user,ethAddress,amount)
    {
        require(address(this).balance >= amount, "Not enough ether balance");
        userBalance[user][ethAddress] -= amount;
        require(user.send(amount), "Ether transfer failed");
    }

    function transferERC20(address from, address to, uint256 amount, address currency)
        external 
        notPaused
        nonReentrant
        currencySupported(currency)
        availableUserBalance(from,currency,amount)
    {
        userBalance[from][currency] -= amount;
        userBalance[to][currency] += amount;
        emit Transferred(from, to, currency, amount);
    }

    function _pause() external onlyOwner {
        paused = true;
        emit Paused();
    }

    function _unpause() external onlyOwner {
        paused = false;
        emit Unpaused();
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
