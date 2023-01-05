pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import "../PriceOracle.sol";
import "../AErc20.sol";
import "../EIP20Interface.sol";
import "../SafeMath.sol";

interface IStdReference {
    /// A structure returned whenever someone requests for standard reference data.
    struct ReferenceData {
        uint256 rate; // base/quote exchange rate, multiplied by 1e18.
        uint256 lastUpdatedBase; // UNIX epoch of the last time when base price gets updated.
        uint256 lastUpdatedQuote; // UNIX epoch of the last time when quote price gets updated.
    }

    /// Returns the price data for the given base/quote pair. Revert if not available.
    function getReferenceData(string calldata _base, string calldata _quote) external view returns (ReferenceData memory);

    /// Similar to getReferenceData, but with multiple base/quote pairs at once.
    function getReferenceDataBulk(string[] calldata _bases, string[] calldata _quotes) external view returns (ReferenceData[] memory);
}

contract AquariusBandPriceOracle is PriceOracle {
    using SafeMath for uint256;
    address public admin;
    address public guardian;

    mapping(address => uint) prices;
    mapping(address => string) feedSymbols;

    event PricePosted(address asset, uint previousPriceMantissa, uint requestedPriceMantissa, uint newPriceMantissa);
    event NewAdmin(address oldAdmin, address newAdmin);
    event NewGuardian(address oldGuardian, address newGuardian);
    event FeedSymbolUpdated(address underlying, string feedSymbol);

    IStdReference ref;

    constructor(IStdReference _ref) public {
        ref = _ref;
        admin = msg.sender;
        guardian = msg.sender;
    }

    function getUnderlyingPrice(AToken aToken) public view returns (uint) {
        if (compareStrings(aToken.symbol(), "aBTT")) {
            IStdReference.ReferenceData memory data = ref.getReferenceData("BTT", "USD");
            return data.rate;
        } else {
            uint256 price;
            EIP20Interface token = EIP20Interface(AErc20(address(aToken)).underlying());

            if(prices[address(token)] != 0) {
                price = prices[address(token)];
            } else {
                string memory feedSymbol = feedSymbols[address(token)];
                IStdReference.ReferenceData memory data = ref.getReferenceData(feedSymbol, "USD");
                price = data.rate;
            }

            uint256 defaultDecimal = 18;
            uint256 tokenDecimal = uint256(token.decimals());
            if(defaultDecimal == tokenDecimal) {
                return price;
            } else if(defaultDecimal > tokenDecimal) {
                return price.mul(10**(defaultDecimal.sub(tokenDecimal)));
            } else {
                return price.div(10**(tokenDecimal.sub(defaultDecimal)));
            }
        }
    }

    function getFeedSymbol(address underlying) public view returns (string memory) {
        return feedSymbols[underlying];
    }

    function getSymbolPrice(string memory symbol) public view returns(uint) {
        uint256 price;
        IStdReference.ReferenceData memory data = ref.getReferenceData(symbol, "USD");
        price = data.rate;
        
        return price;
    }

    function setUnderlyingPrice(AToken aToken, uint underlyingPriceMantissa) public {
        require(msg.sender == admin, "only admin can set underlying price");
        address asset = address(AErc20(address(aToken)).underlying());
        emit PricePosted(asset, prices[asset], underlyingPriceMantissa, underlyingPriceMantissa);
        prices[asset] = underlyingPriceMantissa;
    }

    function setDirectPrice(address asset, uint price) public {
        require(msg.sender == admin, "only admin can set price");
        emit PricePosted(asset, prices[asset], price, price);
        prices[asset] = price;
    }

    function assetPrices(address asset) external view returns (uint) {
        return prices[asset];
    }

    function compareStrings(string memory a, string memory b) internal pure returns (bool) {
        return (keccak256(abi.encodePacked((a))) == keccak256(abi.encodePacked((b))));
    }

    function setFeedSymbol(address underlying, string calldata feedSymbol) external {
        require(msg.sender == admin, "only admin can set feed symbol");
        require(underlying != address(0), "underlying can't be zero");
        require(bytes(feedSymbol).length != 0, "feed symbol can't be zero");

        feedSymbols[underlying] = feedSymbol;

        emit FeedSymbolUpdated(underlying, feedSymbol);
    }

    function setAdmin(address newAdmin) external {
        require(msg.sender == admin || msg.sender == guardian, "only admin and guardian can set new admin");
        address oldAdmin = admin;
        admin = newAdmin;

        emit NewAdmin(oldAdmin, newAdmin);
    }

    function setGuardian(address newGuardian) external {
        require(msg.sender == guardian, "only guardian can set new guardian");
        address oldGuardian = guardian;
        guardian = newGuardian;

        emit NewGuardian(oldGuardian, newGuardian);
    }
}
