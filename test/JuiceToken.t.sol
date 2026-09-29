// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {JuiceToken} from "../contracts/JuiceToken.sol";

contract JuiceTokenTest is Test {
    JuiceToken internal juice;

    address internal owner = makeAddr("owner");
    address internal minter = makeAddr("minter");
    address internal user = makeAddr("user");

    function setUp() public {
        juice = new JuiceToken(owner);
    }

    function test_Metadata() public view {
        assertEq(juice.name(), "Juice");
        assertEq(juice.symbol(), "JUICE");
        assertEq(juice.decimals(), 18);
    }

    function test_OwnerCanAuthorizeAndRevokeMinter() public {
        assertFalse(juice.authorizedMinters(minter));

        vm.prank(owner);
        juice.authorizeMinter(minter);
        assertTrue(juice.authorizedMinters(minter));

        vm.prank(owner);
        juice.revokeMinter(minter);
        assertFalse(juice.authorizedMinters(minter));
    }

    function test_NonOwnerCannotAuthorizeMinter() public {
        vm.prank(user);
        vm.expectRevert();
        juice.authorizeMinter(minter);
    }

    function test_AuthorizedMinterCanMint() public {
        vm.prank(owner);
        juice.authorizeMinter(minter);

        vm.prank(minter);
        juice.mint(user, 100e18);

        assertEq(juice.balanceOf(user), 100e18);
        assertEq(juice.totalSupply(), 100e18);
    }

    function test_UnauthorizedMinterCannotMint() public {
        vm.prank(minter);
        vm.expectRevert(JuiceToken.NotAuthorizedMinter.selector);
        juice.mint(user, 100e18);
    }

    function test_RevokedMinterCannotMintAnymore() public {
        vm.startPrank(owner);
        juice.authorizeMinter(minter);
        juice.revokeMinter(minter);
        vm.stopPrank();

        vm.prank(minter);
        vm.expectRevert(JuiceToken.NotAuthorizedMinter.selector);
        juice.mint(user, 100e18);
    }

    function test_AuthorizedMinterCanBurnFromHolder() public {
        vm.prank(owner);
        juice.authorizeMinter(minter);

        vm.prank(minter);
        juice.mint(user, 100e18);

        vm.prank(minter);
        juice.burn(user, 40e18);

        assertEq(juice.balanceOf(user), 60e18);
    }

    function test_UnauthorizedCannotBurnFromHolder() public {
        vm.prank(owner);
        juice.authorizeMinter(minter);
        vm.prank(minter);
        juice.mint(user, 100e18);

        vm.prank(user);
        vm.expectRevert(JuiceToken.NotAuthorizedMinter.selector);
        juice.burn(user, 10e18);
    }

    function test_AnyoneCanBurnOwn() public {
        vm.prank(owner);
        juice.authorizeMinter(minter);
        vm.prank(minter);
        juice.mint(user, 100e18);

        vm.prank(user);
        juice.burnOwn(30e18);

        assertEq(juice.balanceOf(user), 70e18);
    }

    function test_BurnOwnCannotTouchSomeoneElsesBalance() public {
        vm.prank(owner);
        juice.authorizeMinter(minter);
        vm.prank(minter);
        juice.mint(user, 100e18);

        address stranger = makeAddr("stranger");
        vm.prank(stranger);
        vm.expectRevert();
        juice.burnOwn(1e18);
    }

    function test_IsTransferable() public {
        vm.prank(owner);
        juice.authorizeMinter(minter);
        vm.prank(minter);
        juice.mint(user, 100e18);

        address recipient = makeAddr("recipient");
        vm.prank(user);
        juice.transfer(recipient, 25e18);

        assertEq(juice.balanceOf(user), 75e18);
        assertEq(juice.balanceOf(recipient), 25e18);
    }
}
