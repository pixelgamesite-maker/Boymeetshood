// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {JuiceToken} from "../contracts/JuiceToken.sol";
import {JuiceStaking} from "../contracts/JuiceStaking.sol";

contract DeployJuice is Script {
    // The Boys ERC-721.
    address constant BOYS_NFT = 0xB036c31a01d7D056f70f339a299111775613cbac;

    // Receives staking fees. Both fees default to 0, so nothing flows here
    // until the owner calls setFees.
    address constant TREASURY = 0x05a04a21A20905cF37AE46fBc2a83A3774dbffD2;

    address constant OWNER = 0x05a04a21A20905cF37AE46fBc2a83A3774dbffD2;

    uint256 constant BASE_DAILY_REWARD = 833.5e18;

    // No return value: forge 1.8.x rejects a script `run()` that returns
    // something ("encode length mismatch: expected 0 types, got 1"). The
    // deployed addresses are logged below, which is all we need.
    function run() external {
        vm.startBroadcast();

        JuiceToken juice = new JuiceToken(OWNER);
        JuiceStaking staking = new JuiceStaking(OWNER, BOYS_NFT, address(juice), TREASURY, BASE_DAILY_REWARD);

        vm.stopBroadcast();

        console.log("JuiceToken:   ", address(juice));
        console.log("JuiceStaking: ", address(staking));
        console.log("boysNft:      ", BOYS_NFT);
        console.log("treasury:     ", TREASURY);
        console.log("owner:        ", OWNER);
        console.log("");
        console.log("Still needed before launch:");
        console.log("  1. As OWNER, call juice.authorizeMinter(staking) -- staking can't mint until this runs.");
        console.log("  2. Run SetJuiceRarity.s.sol to populate every token's rarity.");
        console.log("  3. Whitelist the staking address on the Boys transfer-validator (list 156).");
    }
}

contract AuthorizeStakingMinter is Script {
    function run(address juiceToken, address stakingContract) external {
        vm.startBroadcast();
        JuiceToken(juiceToken).authorizeMinter(stakingContract);
        vm.stopBroadcast();

        console.log("Authorized", stakingContract, "to mint", juiceToken);
    }
}
