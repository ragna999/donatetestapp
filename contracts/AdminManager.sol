// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AdminManager
 * @notice Menyimpan daftar admin yang berhak approve/deny kampanye dan withdraw.
 */
contract AdminManager {
    address public owner;
    mapping(address => bool) private admins;

    event AdminAdded(address indexed account);
    event AdminRemoved(address indexed account);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        admins[msg.sender] = true;
        emit AdminAdded(msg.sender);
    }

    function addAdmin(address _account) external onlyOwner {
        require(_account != address(0), "Zero address");
        admins[_account] = true;
        emit AdminAdded(_account);
    }

    function removeAdmin(address _account) external onlyOwner {
        require(_account != owner, "Cannot remove owner");
        admins[_account] = false;
        emit AdminRemoved(_account);
    }

    function isAdmin(address _account) external view returns (bool) {
        return admins[_account];
    }
}
