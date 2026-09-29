// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {JuiceStaking} from "../contracts/JuiceStaking.sol";

/**
 * Populate every Boy's rarity tier on a deployed JuiceStaking contract, from
 * script/data/rarity.json — {tokenIds: uint256[], rarities: string[]},
 * generated from the collection's real OpenSea metadata (see
 * scripts/compute_rarity.py in the same commit for how that tiering was
 * derived: 31 hand-crafted "Special: 1/1" tokens are hard-set to Mythic
 * regardless of OpenSea's own rank — see that script's comments for why —
 * and the rest are bucketed by OpenSea Rarity Rank percentile).
 *
 * All 2,666 tokens don't fit in one transaction, so this chunks the call
 * into batches of BATCH_SIZE (well under the contract's own 500-per-call
 * cap, to keep each transaction's gas comfortable).
 *
 *   forge script script/SetJuiceRarity.s.sol:SetJuiceRarity \
 *     --sig "run(address)" $JUICE_STAKING \
 *     --rpc-url $RPC_URL --private-key $OWNER_PRIVATE_KEY --broadcast
 *
 * Drop --broadcast for a dry run first. Only JuiceStaking's owner can call
 * batchSetRarity, so this must run from the owner wallet.
 */
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
