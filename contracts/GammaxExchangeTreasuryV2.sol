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

    event Paused();
    event Unpaused();
    event UpdateState();
    event AddCurrency(address indexed currency);
    event RemoveCurrency(address indexed currency);

    bool public paused;
    uint public merkleRoot;
    address constant ethAddress = 0x0000000000000000000000000000000000000000;

    mapping(address => mapping( uint => uint256) ) merkleReceipt;

    mapping(address => bool) public supportCurrency;

    constructor() {
        paused = false;
    }

    modifier notPaused() {
        require(!paused, "paused");
        _;
    }

    receive() 
        external 
        payable 
        notPaused
    {
        uint256 amount = msg.value;
        require(amount > 0, "Not enough funds to deposit");
        emit Deposited(msg.sender,ethAddress, amount);
    }

    function depositERC20(address from, address user, uint256 amount, address currency) 
        public
        notPaused
    {
        require(supportCurrency[currency], "Currency not supported");
        IERC20(currency).safeTransferFrom(from, address(this), amount);
        emit Deposited(user,currency, amount);
    }

    function withdrawERC20(bytes calldata message, uint256 amount) 
        public 
        notPaused
        onlyOwner
    {
        (address user, address currency) = withdrawCheck(message,amount);

        require(IERC20(currency).balanceOf(address(this)) >= amount, "Not enough funds in treasury");
        
        IERC20(currency).safeTransfer(user, amount);
        emit Withdrawn(user, currency, amount);
    }

    function forcedWithdraw(
        uint256 amount,
        bytes calldata message,
        uint[] calldata proofs
    )
        external
        nonReentrant
    {
        uint userHash = uint(keccak256(abi.encode(message)));
        // verify hash against merkle root
        require(verifyProof(userHash,proofs), "Invalid hash");
        
        (address user, address currency) = withdrawCheck(message,amount);

        require(IERC20(currency).balanceOf(address(this)) >= amount, "Not enough funds in treasury");

        // transfer funds
        IERC20(currency).safeTransfer(user, amount);
        emit Withdrawn(user, currency, amount);
    }

    function withdrawCheck(bytes calldata message,uint256 amount)
        internal
        returns(address,address)
    {
        // decode message
        ( address user, address currency, uint256 withdrawable) = 
        abi.decode( message, ( address, address, uint256) );

        // check currency
        require(supportCurrency[currency], "Currency not supported");

        // check possibility to withdraw from current state
        uint256 total = merkleReceipt[user][merkleRoot] + amount;
        require(total <= withdrawable, "Not enough balance");
        
        // increase amount withdrawn
        merkleReceipt[user][merkleRoot] = total;
        return (user,currency);
    }

    function withdrawEth(address payable user,uint256 amount)
        public 
        notPaused
        nonReentrant
        onlyOwner
    {
        require(address(this).balance >= amount, "Not enough ether balance");
        require(user.send(amount), "Ether transfer failed");
        emit Withdrawn(user, ethAddress, amount);
    }

    function updateState(uint root)
        external
        onlyOwner
        notPaused
    {
        merkleRoot = root;
        emit UpdateState();
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

    function getRoot() 
        public 
        view 
        returns (uint) 
    {
      return merkleRoot;
    }


    function hash(uint _a) internal pure returns(uint) {
      return uint(keccak256(abi.encode(_a)));
    }

    function pairHash(uint _a, uint _b) internal pure returns(uint) {
      return hash(hash(_a) ^ hash(_b));
    }

    function verifyProof(uint _value, uint[] calldata _proof)
        public view returns (bool) 
    {
      uint temp = _value;
      uint i;

      for(i=0; i<_proof.length; i++) {
        temp = pairHash(temp, _proof[i]);
      }

      return temp == merkleRoot;
    }
}
