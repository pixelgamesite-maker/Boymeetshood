// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {JuiceToken} from "../contracts/JuiceToken.sol";
import {JuiceStaking} from "../contracts/JuiceStaking.sol";

/**
 * Deploy JuiceToken + JuiceStaking, and wire the staking contract up as an
 * authorized minter so it can pay out $JUICE.
 *
 *   forge script script/DeployJuice.s.sol:DeployJuice \
 *     --rpc-url $RPC_URL \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast
 *
 * Drop --broadcast for a dry run that simulates and prints the addresses
 * without sending anything. Always dry run first.
 *
 * After this runs, two things still need doing before staking can go live:
 *   1. Run SetJuiceRarity.s.sol to populate every token's rarity tier.
 *   2. From the Boys collection owner wallet, call addAccountsToWhitelist on
 *      the Limit Break transfer-validator (list 156) to allow the new
 *      JuiceStaking address to move Boys — exactly the same step the
 *      lending contract needed. Staking will revert on every transfer until
 *      this is done.
 */
contract DeployJuice is Script {
    // The Boys ERC-721.
    address constant BOYS_NFT = 0xB036c31a01d7D056f70f339a299111775613cbac;

    // Receives staking fees. Both fees default to 0, so nothing flows here
    // until the owner calls setFees.
    address constant TREASURY = 0x05a04a21A20905cF37AE46fBc2a83A3774dbffD2;

    /**
     * Owner of both new contracts: can set rarity, fees, treasury, and
     * pause/unpause staking, plus authorize/revoke $JUICE minters.
     *
     * Set explicitly rather than read from msg.sender — inside a forge
     * script, msg.sender before vm.startBroadcast() is Foundry's default
     * sender (0x1804c8AB...), not your wallet, which would silently deploy
     * with the wrong owner.
     *
     * ⚠️ EDIT THIS to the address you want owning the contracts.
     */
    address constant OWNER = 0x05a04a21A20905cF37AE46fBc2a83A3774dbffD2;

    /**
     * $JUICE earned per day at Common (1x) rarity, 18 decimals. Plain
     * storage on the deployed contract, not hardcoded — retune anytime with
     * staking.setBaseDailyReward(...), no redeploy needed.
     */
    uint256 constant BASE_DAILY_REWARD = 833.5e18;

    function run() external returns (JuiceToken juice, JuiceStaking staking) {
        vm.startBroadcast();

        juice = new JuiceToken(OWNER);
        staking = new JuiceStaking(OWNER, BOYS_NFT, address(juice), TREASURY, BASE_DAILY_REWARD);

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

/**
 * Separate from `run` because authorizing a minter is a one-line owner call
 * that's easy to forget, or that you may want to re-run against an already
 * -deployed pair (e.g. after swapping in a new staking contract). Keeping it
 * as its own script makes that a single deliberate action instead of
 * something buried inside a bigger deploy.
 *
 *   forge script script/DeployJuice.s.sol:AuthorizeStakingMinter \
 *     --sig "run(address,address)" $JUICE_TOKEN $JUICE_STAKING \
 *     --rpc-url $RPC_URL --private-key $OWNER_PRIVATE_KEY --broadcast
 */
contract AuthorizeStakingMinter is Script {
    function run(address juiceToken, address stakingContract) external {
        vm.startBroadcast();
        JuiceToken(juiceToken).authorizeMinter(stakingContract);
        vm.stopBroadcast();

        console.log("Authorized", stakingContract, "to mint", juiceToken);
    }
}
