// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {JuiceStaking} from "../contracts/JuiceStaking.sol";

/**
 * Deploy JuiceStaking against a JuiceToken that's already live (deployed
 * separately, e.g. via Remix). Use this instead of DeployJuice.s.sol when
 * you don't want a second $JUICE token deployed.
 *
 *   forge script script/DeployJuiceStakingOnly.s.sol:DeployJuiceStakingOnly \
 *     --rpc-url $RPC_URL \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast
 *
 * Drop --broadcast for a dry run that simulates and prints the address
 * without sending anything. Always dry run first.
 *
 * After this runs, two things still need doing before staking can go live:
 *   1. As OWNER, call JuiceToken(JUICE).authorizeMinter(staking) -- staking
 *      can't mint until this runs.
 *   2. Run SetJuiceRarity.s.sol to populate every token's rarity tier.
 *   3. From the Boys collection owner wallet, call addAccountsToWhitelist on
 *      the Limit Break transfer-validator (list 156) to allow the new
 *      JuiceStaking address to move Boys — exactly the same step the
 *      lending contract needed. Staking will revert on every transfer until
 *      this is done.
 */
contract DeployJuiceStakingOnly is Script {
    // The Boys ERC-721.
    address constant BOYS_NFT = 0xB036c31a01d7D056f70f339a299111775613cbac;

    // Already-deployed JuiceToken. ⚠️ Confirm this matches before running.
    address constant JUICE = 0x02C0B72779234E7a8666190917D3327f1554dED6;

    // Receives staking fees. Both fees default to 0, so nothing flows here
    // until the owner calls setFees.
    address constant TREASURY = 0x05a04a21A20905cF37AE46fBc2a83A3774dbffD2;

    /**
     * Owner of the new contract: can set rarity, fees, treasury, and
     * pause/unpause staking.
     *
     * Set explicitly rather than read from msg.sender — inside a forge
     * script, msg.sender before vm.startBroadcast() is Foundry's default
     * sender (0x1804c8AB...), not your wallet, which would silently deploy
     * with the wrong owner.
     *
     * ⚠️ EDIT THIS to the address you want owning the contract.
     */
    address constant OWNER = 0x05a04a21A20905cF37AE46fBc2a83A3774dbffD2;

    /**
     * $JUICE earned per day at Common (1x) rarity, 18 decimals. Plain
     * storage on the deployed contract, not hardcoded — retune anytime with
     * staking.setBaseDailyReward(...), no redeploy needed.
     *
     * Derived from the client's target: 1,000,000,000 total $JUICE supply x
     * 40% to staking, spread over an assumed 2,666-NFT collection over 180
     * days (6 x 30-day months) => ~833.5 $JUICE/day per Common Boy.
     * ⚠️ Recheck this against the real collection size and confirm with the
     * client before relying on it — it's just the reverse-engineered number
     * from the table they sent, not a fee they specified directly.
     */
    uint256 constant BASE_DAILY_REWARD = 833.5e18;

    function run() external returns (JuiceStaking staking) {
        vm.startBroadcast();

        staking = new JuiceStaking(OWNER, BOYS_NFT, JUICE, TREASURY, BASE_DAILY_REWARD);

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
