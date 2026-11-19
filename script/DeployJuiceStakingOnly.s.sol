// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {JuiceStaking} from "../contracts/JuiceStaking.sol";

contract DeployJuiceStakingOnly is Script {

    address constant BOYS_NFT = 0xB036c31a01d7D056f70f339a299111775613cbac;

    address constant JUICE = 0x02C0B72779234E7a8666190917D3327f1554dED6;

    address constant TREASURY = 0x05a04a21A20905cF37AE46fBc2a83A3774dbffD2;

    address constant OWNER = 0x05a04a21A20905cF37AE46fBc2a83A3774dbffD2;

    uint256 constant BASE_DAILY_REWARD = 833.5e18;

    function run() external {
        vm.startBroadcast();

        JuiceStaking staking = new JuiceStaking(OWNER, BOYS_NFT, JUICE, TREASURY, BASE_DAILY_REWARD);

        vm.stopBroadcast();

        console.log("JuiceStaking:     ", address(staking));
        console.log("juice:            ", JUICE);
        console.log("boysNft:          ", BOYS_NFT);
        console.log("treasury:         ", TREASURY);
        console.log("owner:            ", OWNER);
        console.log("baseDailyReward:  ", BASE_DAILY_REWARD);
        console.log("");
        console.log("Still needed before launch:");
        console.log("  1. As OWNER, call JuiceToken(JUICE).authorizeMinter(staking) -- staking can't mint until this runs.");
        console.log("  2. Run SetJuiceRarity.s.sol to populate every token's rarity.");
        console.log("  3. Whitelist the staking address on the Boys transfer-validator (list 156).");
    }
}
