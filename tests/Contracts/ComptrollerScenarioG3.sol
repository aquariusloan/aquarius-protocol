pragma solidity ^0.5.16;

import "../../contracts/ComptrollerG3.sol";

contract ComptrollerScenarioG3 is ComptrollerG3 {
    uint public blockNumber;
    address public arsAddress;

    constructor() ComptrollerG3() public {}

    function setArsAddress(address arsAddress_) public {
        arsAddress = arsAddress_;
    }

    function getArsAddress() public view returns (address) {
        return arsAddress;
    }

    function membershipLength(AToken aToken) public view returns (uint) {
        return accountAssets[address(aToken)].length;
    }

    function fastForward(uint blocks) public returns (uint) {
        blockNumber += blocks;

        return blockNumber;
    }

    function setBlockNumber(uint number) public {
        blockNumber = number;
    }

    function getBlockNumber() public view returns (uint) {
        return blockNumber;
    }

    function getArsMarkets() public view returns (address[] memory) {
        uint m = allMarkets.length;
        uint n = 0;
        for (uint i = 0; i < m; i++) {
            if (markets[address(allMarkets[i])].isComped) {
                n++;
            }
        }

        address[] memory arsMarkets = new address[](n);
        uint k = 0;
        for (uint i = 0; i < m; i++) {
            if (markets[address(allMarkets[i])].isComped) {
                arsMarkets[k++] = address(allMarkets[i]);
            }
        }
        return arsMarkets;
    }

    function unlist(AToken aToken) public {
        markets[address(aToken)].isListed = false;
    }
}
