pragma solidity ^0.5.16;

import "./SafeMath.sol";
import "./AToken.sol";

interface IComptroller {
    // mapping(address => bool) public mintGuardianPaused;

    function getMintGuardianPaused(AToken aToken) external view returns(bool);

    // mapping(address => bool) public borrowGuardianPaused;

    function getBorrowGuardianPaused(AToken aToken) external view returns(bool);

    function getAllMarkets() external view returns (AToken[] memory);
}

// Modified from Compound Timelock Admin
// https://raw.githubusercontent.com/compound-finance/compound-protocol/master/contracts/Timelock.sol
contract PausingTimelock {
    using SafeMath for uint;

    event NewAdmin(address indexed newAdmin);
    event NewPendingAdmin(address indexed newPendingAdmin);
    event NewEmergencyAdmin(address indexed newEmergencyAdmin);
    event NewPendingEmergencyAdmin(address indexed newPendingEmergencyAdmin);
    event NewComptroller(address indexed newComptroller);
    event NewDelay(uint indexed newDelay);
    event CancelTransaction(bytes32 indexed txHash, address indexed target, uint value, string signature, bytes data, uint eta);
    event ExecuteTransaction(bytes32 indexed txHash, address indexed target, uint value, string signature, bytes data, uint eta);
    event QueueTransaction(bytes32 indexed txHash, address indexed target, uint value, string signature, bytes data, uint eta);
    event RenounceEmergencyAdmin();

    uint public constant GRACE_PERIOD = 14 days;
    uint public constant MINIMUM_DELAY = 2 days;
    uint public constant MAXIMUM_DELAY = 30 days;

    IComptroller public comptroller;

    address public admin;
    address public pendingAdmin;
    address public emergencyAdmin;
    address public pendingEmergencyAdmin;
    uint public delay;

    mapping (bytes32 => bool) public queuedTransactions;

    constructor(address admin_, address emergencyAdmin_, uint delay_, IComptroller comptroller_) public {
        require(delay_ >= MINIMUM_DELAY, "PausingTimelock::constructor: Delay must exceed minimum delay.");
        require(delay_ <= MAXIMUM_DELAY, "PausingTimelock::constructor: Delay must not exceed maximum delay.");

        admin = admin_;
        emergencyAdmin = emergencyAdmin_;
        delay = delay_;
        comptroller = IComptroller(comptroller_);
    }

    function() external payable { }

    function setDelay(uint delay_) public {
        require(msg.sender == address(this), "Timelock::setDelay: Call must come from Timelock.");
        require(delay_ >= MINIMUM_DELAY, "Timelock::setDelay: Delay must exceed minimum delay.");
        require(delay_ <= MAXIMUM_DELAY, "Timelock::setDelay: Delay must not exceed maximum delay.");
        delay = delay_;

        emit NewDelay(delay);
    }

    function acceptAdmin() public {
        require(msg.sender == pendingAdmin, "Timelock::acceptAdmin: Call must come from pendingAdmin.");
        admin = msg.sender;
        pendingAdmin = address(0);

        emit NewAdmin(admin);
    }

    function setPendingAdmin(address pendingAdmin_) public {
        require(msg.sender == address(this), "Timelock::setPendingAdmin: Call must come from Timelock.");
        pendingAdmin = pendingAdmin_;

        emit NewPendingAdmin(pendingAdmin);
    }

    function acceptEmergencyAdmin() public {
        require(msg.sender == pendingEmergencyAdmin, "Timelock::acceptEmergencyAdmin: Call must come from pendingEmergencyAdmin.");
        emergencyAdmin = msg.sender;
        pendingEmergencyAdmin = address(0);

        emit NewEmergencyAdmin(emergencyAdmin);
    }

    function setPendingEmergencyAdmin(address pendingEmergencyAdmin_) public {
        require(msg.sender == address(this), "Timelock::setPendingEmergencyAdmin: Call must come from Timelock.");
        pendingEmergencyAdmin = pendingEmergencyAdmin_;

        emit NewPendingEmergencyAdmin(pendingEmergencyAdmin_);
    }

    function setComptroller(address comptroller_) public {
        require(msg.sender == address(this), "Timelock::setComptroller: Call must come from Timelock.");
        comptroller = IComptroller(comptroller_);

        emit NewComptroller(comptroller_);
    }

    function queueTransaction(address target, uint value, string memory signature, bytes memory data, uint eta) public returns (bytes32) {
        if (getPausedMarkets()) {
            require(msg.sender == emergencyAdmin, "Timelock::queueTransaction: Call must come from emergency admin.");
        } else {
            require(msg.sender == admin, "Timelock::queueTransaction: Call must come from admin.");
        }
        
        require(eta >= getBlockTimestamp().add(delay), "Timelock::queueTransaction: Estimated execution block must satisfy delay.");

        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        queuedTransactions[txHash] = true;

        emit QueueTransaction(txHash, target, value, signature, data, eta);
        return txHash;
    }

    function cancelTransaction(address target, uint value, string memory signature, bytes memory data, uint eta) public {
        if (getPausedMarkets()) {
            require(msg.sender == emergencyAdmin, "Timelock::cancelTransaction: Call must come from emergency admin.");
        } else {
            require(msg.sender == admin, "Timelock::cancelTransaction: Call must come from admin.");
        }

        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        queuedTransactions[txHash] = false;

        emit CancelTransaction(txHash, target, value, signature, data, eta);
    }

    function executeTransaction(address target, uint value, string memory signature, bytes memory data, uint eta) public payable returns (bytes memory) {
        if (getPausedMarkets()) {
            require(msg.sender == emergencyAdmin, "Timelock::executeTransaction: Call must come from emergency admin.");
        } else {
            require(msg.sender == admin, "Timelock::executeTransaction: Call must come from admin.");
        }

        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        require(queuedTransactions[txHash], "Timelock::executeTransaction: Transaction hasn't been queued.");
        require(getBlockTimestamp() >= eta, "Timelock::executeTransaction: Transaction hasn't surpassed time lock.");
        require(getBlockTimestamp() <= eta.add(GRACE_PERIOD), "Timelock::executeTransaction: Transaction is stale.");

        queuedTransactions[txHash] = false;

        bytes memory callData;

        if (bytes(signature).length == 0) {
            callData = data;
        } else {
            callData = abi.encodePacked(bytes4(keccak256(bytes(signature))), data);
        }

        // solium-disable-next-line security/no-call-value
        (bool success, bytes memory returnData) = target.call.value(value)(callData);
        require(success, "Timelock::executeTransaction: Transaction execution reverted.");

        emit ExecuteTransaction(txHash, target, value, signature, data, eta);

        return returnData;
    }

    function renounceEmergencyAdmin() public {
        require(msg.sender == admin || msg.sender == emergencyAdmin, "Timelock:: call must come from admin or emergency admin");

        emergencyAdmin = address(0);

        emit RenounceEmergencyAdmin();
    }

    function getPausedMarkets() public view returns (bool) {
        // Any paused market return TRUE
        bool paused = false;
        AToken[] memory allMarkets = comptroller.getAllMarkets();
        for (uint i = 0; i < allMarkets.length; i++) {
            if(comptroller.getMintGuardianPaused(allMarkets[i]) && comptroller.getBorrowGuardianPaused(allMarkets[i])) {
                paused = true;
                break;
            }
        }

        return paused;
    }

    function getBlockTimestamp() internal view returns (uint) {
        // solium-disable-next-line security/no-block-members
        return block.timestamp;
    }
}