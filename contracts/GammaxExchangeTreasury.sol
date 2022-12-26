// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

pragma experimental ABIEncoderV2;

contract GammaxExchangeTreasury is Ownable {
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;
    Counters.Counter private _requestId;

    struct ClaimRequest {
        bool isETH;
        address payable to;
        address currency;
        uint256 amount;
        uint256 approveCount;
        uint256 deadline;
        mapping(address => bool) approveStatus;
    }
    event ReceiveEther(address sender, uint256 amount);
    event Claimed(
        uint256 indexed id,
        address indexed to,
        bool isETH,
        address currency,
        uint256 amount,
        uint256 deadline
    );
    event ClaimRequestCreated(
        uint256 indexed id,
        address indexed to,
        bool isETH,
        address currency,
        uint256 amount,
        uint256 deadline
    );
    event TransferToCounterParty(bool isETH, address currency, uint256 amount);
    event Paused();
    event Unpaused();
    event NewTruthHolder(address newTruthHolder);
    event NewOperator(address oldOperator, address newOperator);
    event NewCounterParty(address oldCounterParty, address newCounterParty);
    event AddCurrency(address indexed currency);
    event RemoveCurrency(address indexed currency);

    bool public paused;
    address[] public truthHolders;
    address public operator;
    address payable public counterParty;
    mapping(address => bool) public supportCurrency;
    mapping(uint256 => uint256) public claimHistory;
    mapping(address => bool) public isTruthHolder;
    mapping(uint256 => ClaimRequest) public requestList;

    modifier notPaused() {
        require(!paused, "paused");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator, "only operator can call");
        _;
    }

    modifier onlyHolder() {
        require(isTruthHolder[msg.sender], "only truthHolder can call");
        _;
    }

    constructor(address operator_, address payable counterParty_) {
        paused = false;
        operator = operator_;
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
    ) external onlyOperator {
        _transfer(counterParty, isETH, currency, amount);
        emit TransferToCounterParty(isETH, currency, amount);
    }

    function addClaimRequest(
        address payable to,
        bool isETH,
        address currency,
        uint256 amount,
        uint256 deadline
    ) external {
        _requestId.increment();
        uint256 _reqID = _requestId.current();
        requestList[_reqID].isETH = isETH;
        requestList[_reqID].to = to;
        requestList[_reqID].currency = currency;
        requestList[_reqID].amount = amount;
        requestList[_reqID].deadline = deadline;
        emit ClaimRequestCreated(_reqID, to, isETH, currency, amount, deadline);
    }

    function claim(uint256 _id) external notPaused onlyHolder {
        require(
            requestList[_id].isETH ||
                supportCurrency[requestList[_id].currency],
            "currency not support"
        );
        require(
            !requestList[_id].approveStatus[msg.sender],
            "already approved"
        );
        uint256 truthLen = truthHolders.length;
        requestList[_id].approveStatus[msg.sender] = true;
        requestList[_id].approveCount++;
        if (requestList[_id].approveCount == truthLen) {
            require(
                block.timestamp < requestList[_id].deadline,
                "already passed deadline"
            );
            claimHistory[_id] = block.number;
            _transfer(
                requestList[_id].to,
                requestList[_id].isETH,
                requestList[_id].currency,
                requestList[_id].amount
            );
            emit Claimed(
                _id,
                requestList[_id].to,
                requestList[_id].isETH,
                requestList[_id].currency,
                requestList[_id].amount,
                requestList[_id].deadline
            );
        }
    }

    function _pause() external onlyOwner {
        paused = true;
        emit Paused();
    }

    function _unpause() external onlyOwner {
        paused = false;
        emit Unpaused();
    }

    function _setOperator(address newOperator) external onlyOwner {
        address oldOperator = operator;
        operator = newOperator;
        emit NewOperator(oldOperator, newOperator);
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

    function _addTruthHolder(address newTruthHolder) external onlyOwner {
        require(!isTruthHolder[newTruthHolder], "Existed holder.");
        truthHolders.push(newTruthHolder);
        isTruthHolder[newTruthHolder] = true;
        emit NewTruthHolder(newTruthHolder);
    }

    function _removeTruthHolder(address _truthHolder) external onlyOwner {
        require(isTruthHolder[_truthHolder], "Not existed holder.");
        uint256 truthHolderCount = truthHolders.length;
        isTruthHolder[_truthHolder] = false;
        for (uint8 i = 0; i < truthHolderCount; i++) {
            if (truthHolders[i] == _truthHolder) {
                truthHolders[i] = truthHolders[truthHolderCount - 1];
                truthHolders.pop();
            }
        }
    }

    function _getTruthHolder() public view returns (address[] memory) {
        return truthHolders;
    }
}
