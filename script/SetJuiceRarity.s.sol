// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {JuiceStaking} from "../contracts/JuiceStaking.sol";

contract SetJuiceRarity is Script {
    uint256 constant BATCH_SIZE = 400;

    function run(address stakingContract) external {
        JuiceStaking staking = JuiceStaking(payable(stakingContract));

        string memory json = vm.readFile("script/data/rarity.json");
        uint256[] memory tokenIds = vm.parseJsonUintArray(json, ".tokenIds");
        string[] memory rarities = vm.parseJsonStringArray(json, ".rarities");
        require(tokenIds.length == rarities.length, "length mismatch");

        uint256 total = tokenIds.length;
        console.log("Setting rarity for", total, "tokens in batches of", BATCH_SIZE);

        vm.startBroadcast();

        for (uint256 start = 0; start < total; start += BATCH_SIZE) {
            uint256 end = start + BATCH_SIZE;
            if (end > total) end = total;
            uint256 len = end - start;

            uint256[] memory idsBatch = new uint256[](len);
            string[] memory raritiesBatch = new string[](len);
            for (uint256 i = 0; i < len; i++) {
                idsBatch[i] = tokenIds[start + i];
                raritiesBatch[i] = rarities[start + i];
            }

            staking.batchSetRarity(idsBatch, raritiesBatch);
            console.log("  set tokens", start + 1, "-", end);
        }

        vm.stopBroadcast();

        console.log("Done. All", total, "tokens have a rarity tier set.");
    }
}
