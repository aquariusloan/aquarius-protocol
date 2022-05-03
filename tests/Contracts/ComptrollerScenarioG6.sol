pragma solidity ^0.5.16;

import "../../contracts/ComptrollerG6.sol";

contract ComptrollerScenarioG6 is ComptrollerG6 {
    uint public blockNumber;
    address public arsAddress;

    constructor() ComptrollerG6() public {}

    function fastForward(uint blocks) public returns (uint) {
        blockNumber += blocks;
        return blockNumber;
    }

    function setArsAddress(address arsAddress_) public {
        arsAddress = arsAddress_;
    }

    function getArsAddress() public view returns (address) {
        return arsAddress;
    }

    function setBlockNumber(uint number) public {
        blockNumber = number;
    }

    function getBlockNumber() public view returns (uint) {
        return blockNumber;
    }

    function membershipLength(AToken aToken) public view returns (uint) {
        return accountAssets[address(aToken)].length;
    }

    function unlist(AToken aToken) public {
        markets[address(aToken)].isListed = false;
    }

    function setArsSpeed(address aToken, uint arsSpeed) public {
        arsSpeeds[aToken] = arsSpeed;
    }
}
