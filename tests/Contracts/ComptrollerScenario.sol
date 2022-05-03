pragma solidity ^0.5.16;

import "../../contracts/Comptroller.sol";

contract ComptrollerScenario is Comptroller {
    uint public blockNumber;
    address public arsAddress;

    constructor() Comptroller() public {}

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

    function setArsBorrowerIndex(address aToken, address borrower, uint index) public {
        arsBorrowerIndex[aToken][borrower] = index;
    }

    function setArsSupplierIndex(address aToken, address supplier, uint index) public {
        arsSupplierIndex[aToken][supplier] = index;
    }

    /**
     * @notice Recalculate and update ARS speeds for all ARS markets
     */
    function refreshArsSpeeds() public {
        AToken[] memory allMarkets_ = allMarkets;

        for (uint i = 0; i < allMarkets_.length; i++) {
            AToken aToken = allMarkets_[i];
            Exp memory borrowIndex = Exp({mantissa: aToken.borrowIndex()});
            updateArsSupplyIndex(address(aToken));
            updateArsBorrowIndex(address(aToken), borrowIndex);
        }

        Exp memory totalUtility = Exp({mantissa: 0});
        Exp[] memory utilities = new Exp[](allMarkets_.length);
        for (uint i = 0; i < allMarkets_.length; i++) {
            AToken aToken = allMarkets_[i];
            if (arsSupplySpeeds[address(aToken)] > 0 || arsBorrowSpeeds[address(aToken)] > 0) {
                Exp memory assetPrice = Exp({mantissa: oracle.getUnderlyingPrice(aToken)});
                Exp memory utility = mul_(assetPrice, aToken.totalBorrows());
                utilities[i] = utility;
                totalUtility = add_(totalUtility, utility);
            }
        }

        for (uint i = 0; i < allMarkets_.length; i++) {
            AToken aToken = allMarkets[i];
            uint newSpeed = totalUtility.mantissa > 0 ? mul_(arsRate, div_(utilities[i], totalUtility)) : 0;
            setArsSpeedInternal(aToken, newSpeed, newSpeed);
        }
    }
}
