pragma solidity ^0.5.16;

import "./AToken.sol";
import "./PriceOracle.sol";

contract UnitrollerAdminStorage {
    /**
    * @notice Administrator for this contract
    */
    address public admin;

    /**
    * @notice Pending administrator for this contract
    */
    address public pendingAdmin;

    /**
    * @notice Active brains of Unitroller
    */
    address public comptrollerImplementation;

    /**
    * @notice Pending brains of Unitroller
    */
    address public pendingComptrollerImplementation;
}

contract ComptrollerV1Storage is UnitrollerAdminStorage {

    /**
     * @notice Oracle which gives the price of any given asset
     */
    PriceOracle public oracle;

    /**
     * @notice Multiplier used to calculate the maximum repayAmount when liquidating a borrow
     */
    uint public closeFactorMantissa;

    /**
     * @notice Multiplier representing the discount on collateral that a liquidator receives
     */
    uint public liquidationIncentiveMantissa;

    /**
     * @notice Max number of assets a single account can participate in (borrow or use as collateral)
     */
    uint public maxAssets;

    /**
     * @notice Per-account mapping of "assets you are in", capped by maxAssets
     */
    mapping(address => AToken[]) public accountAssets;

}

contract ComptrollerV2Storage is ComptrollerV1Storage {
    struct Market {
        /// @notice Whether or not this market is listed
        bool isListed;

        /**
         * @notice Multiplier representing the most one can borrow against their collateral in this market.
         *  For instance, 0.9 to allow borrowing 90% of collateral value.
         *  Must be between 0 and 1, and stored as a mantissa.
         */
        uint collateralFactorMantissa;

        /// @notice Per-market mapping of "accounts in this asset"
        mapping(address => bool) accountMembership;

        /// @notice Whether or not this market receives ARS
        bool isComped;
    }

    /**
     * @notice Official mapping of aTokens -> Market metadata
     * @dev Used e.g. to determine if a market is supported
     */
    mapping(address => Market) public markets;


    /**
     * @notice The Pause Guardian can pause certain actions as a safety mechanism.
     *  Actions which allow users to remove their own assets cannot be paused.
     *  Liquidation / seizing / transfer can only be paused globally, not by market.
     */
    address public pauseGuardian;
    bool public _mintGuardianPaused;
    bool public _borrowGuardianPaused;
    bool public transferGuardianPaused;
    bool public seizeGuardianPaused;
    mapping(address => bool) public mintGuardianPaused;
    mapping(address => bool) public borrowGuardianPaused;
}

contract ComptrollerV3Storage is ComptrollerV2Storage {
    struct ArsMarketState {
        /// @notice The market's last updated arsBorrowIndex or arsSupplyIndex
        uint224 index;

        /// @notice The block number the index was last updated at
        uint32 block;
    }

    /// @notice A list of all markets
    AToken[] public allMarkets;

    /// @notice The rate at which the flywheel distributes ARS, per block
    uint public arsRate;

    /// @notice The portion of arsRate that each market currently receives
    mapping(address => uint) public arsSpeeds;

    /// @notice The ARS market supply state for each market
    mapping(address => ArsMarketState) public arsSupplyState;

    /// @notice The ARS market borrow state for each market
    mapping(address => ArsMarketState) public arsBorrowState;

    /// @notice The ARS borrow index for each market for each supplier as of the last time they accrued ARS
    mapping(address => mapping(address => uint)) public arsSupplierIndex;

    /// @notice The ARS borrow index for each market for each borrower as of the last time they accrued ARS
    mapping(address => mapping(address => uint)) public arsBorrowerIndex;

    /// @notice The ARS accrued but not yet transferred to each user
    mapping(address => uint) public arsAccrued;
}

contract ComptrollerV4Storage is ComptrollerV3Storage {
    // @notice The borrowCapGuardian can set borrowCaps to any number for any market. Lowering the borrow cap could disable borrowing on the given market.
    address public borrowCapGuardian;

    // @notice Borrow caps enforced by borrowAllowed for each aToken address. Defaults to zero which corresponds to unlimited borrowing.
    mapping(address => uint) public borrowCaps;
}

contract ComptrollerV5Storage is ComptrollerV4Storage {
    /// @notice The portion of ARS that each contributor receives per block
    mapping(address => uint) public arsContributorSpeeds;

    /// @notice Last block at which a contributor's ARS rewards have been allocated
    mapping(address => uint) public lastContributorBlock;
}

contract ComptrollerV6Storage is ComptrollerV5Storage {
    /// @notice The rate at which ars is distributed to the corresponding borrow market (per block)
    mapping(address => uint) public arsBorrowSpeeds;

    /// @notice The rate at which ars is distributed to the corresponding supply market (per block)
    mapping(address => uint) public arsSupplySpeeds;
}

contract ComptrollerV7Storage is ComptrollerV6Storage {
    /// @notice Flag indicating whether the function to fix ARS accruals has been executed (RE: proposal 62 bug)
    bool public proposal65FixExecuted;

    /// @notice Accounting storage mapping account addresses to how much ARS they owe the protocol.
    mapping(address => uint) public arsReceivable;
}

contract ComptrollerV8Storage is ComptrollerV7Storage {
    /**
     * @notice The Team Pause Guardian can pause certain actions as a safety mechanism.
     *  Actions which allow users to remove their own assets cannot be paused.
     *  Liquidation / seizing / transfer can only be paused globally, not by market.
     */
    address public teamPauseGuardian;
}
