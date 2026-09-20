// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {BoyMeetsHoodLending} from "../contracts/BoyMeetsHoodLending.sol";

/**
 * Deploy BoyMeetsHoodLending.
 *
 *   forge script script/Deploy.s.sol:Deploy \
 *     --rpc-url $RPC_URL \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast
 *
 * Drop --broadcast for a dry run that simulates and prints the address
 * without sending anything. Always dry run first.
 */
contract Deploy is Script {
    // The Boys ERC-721.
    address constant COLLECTION = 0xb036C31a01D7d056F70F339A299111775613cbAC;

    // USDG (Global Dollar) on Robinhood Chain. 6 decimals.
    address constant CURRENCY = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;

    // Receives the protocol fee on repayment.
    address constant TREASURY = 0x05a04a21A20905cF37AE46fBc2a83A3774dbffD2;

    /**
     * Protocol fee in basis points, paid by the borrower on repayment.
     * 0 = free market. 250 = 2.5%. Hard cap in the contract is 500 (5%).
     *
     * Starting at 0 is the low-risk choice: it's changeable later with
     * setFeeBps, and launching with a fee nobody agreed to is harder to walk
     * back than adding one once there's volume.
     */
    uint16 constant FEE_BPS = 0;

    function run() external returns (BoyMeetsHoodLending lending) {
        // The owner is whoever holds the deploying key. This address can set
        // the fee, change the treasury, and pause — keep it safe, and move it
        // to a multisig before there is real volume.
        address owner = msg.sender;

        vm.startBroadcast();

        lending = new BoyMeetsHoodLending(
            COLLECTION,
            CURRENCY,
            TREASURY,
            FEE_BPS,
            owner
        );

        vm.stopBroadcast();

        console.log("BoyMeetsHoodLending:", address(lending));
        console.log("collection:        ", COLLECTION);
        console.log("currency:          ", CURRENCY);
        console.log("treasury:          ", TREASURY);
        console.log("feeBps:            ", FEE_BPS);
        console.log("owner:             ", owner);
    }
}
