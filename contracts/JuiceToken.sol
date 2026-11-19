// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract JuiceToken is ERC20, Ownable {
    /* ────────────────────────────── State ────────────────────────────── */

    /// @notice Contracts allowed to mint and burn on behalf of a holder.
    mapping(address => bool) public authorizedMinters;

    /* ────────────────────────────── Events ───────────────────────────── */

    event MinterAuthorized(address indexed minter);
    event MinterRevoked(address indexed minter);

    /* ─────────────────────────────── Errors ──────────────────────────── */

    error NotAuthorizedMinter();

    /* ──────────────────────────── Modifiers ──────────────────────────── */

    modifier onlyAuthorizedMinter() {
        if (!authorizedMinters[msg.sender]) revert NotAuthorizedMinter();
        _;
    }

    /* ──────────────────────────── Constructor ─────────────────────────── */

    constructor(address _owner) ERC20("Juice", "JUICE") Ownable(_owner) {}

    /* ─────────────────────────── Minter admin ────────────────────────── */

    function authorizeMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = true;
        emit MinterAuthorized(minter);
    }

    function revokeMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = false;
        emit MinterRevoked(minter);
    }

    /* ──────────────────────────── Mint / burn ─────────────────────────── */

    /// @notice Mint reward tokens. Called by JuiceStaking when a stake claims.
    function mint(address to, uint256 amount) external onlyAuthorizedMinter {
        _mint(to, amount);
    }

    /// @notice Burn from an arbitrary holder. For a future conversion
    /// contract that exchanges $JUICE for the main token at launch.
    function burn(address from, uint256 amount) external onlyAuthorizedMinter {
        _burn(from, amount);
    }

    /// @notice Burn your own balance — needs no authorization, since you can
    /// only ever destroy value you hold.
    function burnOwn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
