// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./DonationCampaign.sol";

interface IAdminManagerFactory {
    function isAdmin(address _addr) external view returns (bool);
}

/**
 * @title CampaignFactory
 * @notice Deploy dan kelola semua kampanye donasi.
 *         Admin bisa approve atau deny kampanye sebelum tampil ke publik.
 */
contract CampaignFactory {
    address public adminContract;

    address[] public campaigns;

    mapping(address => address) public campaignToCreator;
    mapping(address => bool)    public isApproved;
    mapping(address => bool)    public deniedCampaigns;

    event CampaignCreated(address indexed campaignAddress, address indexed creator);
    event CampaignApproved(address indexed campaignAddress);
    event CampaignDenied(address indexed campaignAddress);

    modifier onlyAdmin() {
        require(IAdminManagerFactory(adminContract).isAdmin(msg.sender), "Only admin");
        _;
    }

    constructor(address _adminContract) {
        require(_adminContract != address(0), "Invalid admin contract");
        adminContract = _adminContract;
    }

    /**
     * @notice Siapapun bisa membuat kampanye baru.
     *         Kampanye masuk status pending sampai admin menyetujuinya.
     */
    function createCampaign(
        string memory _title,
        string memory _desc,
        string memory _image,
        uint256 _goal,
        string memory _location,
        uint256 _duration,
        string memory _social
    ) external {
        DonationCampaign newCampaign = new DonationCampaign(
            _title,
            _desc,
            _image,
            _goal,
            _location,
            _duration,
            _social,
            msg.sender,
            adminContract
        );

        address campaignAddr = address(newCampaign);
        campaigns.push(campaignAddr);
        campaignToCreator[campaignAddr] = msg.sender;

        emit CampaignCreated(campaignAddr, msg.sender);
    }

    /**
     * @notice Admin menyetujui kampanye agar tampil ke publik.
     */
    function approveCampaign(address _campaign) external onlyAdmin {
        require(campaignToCreator[_campaign] != address(0), "Campaign not found");
        require(!isApproved[_campaign], "Already approved");
        require(!deniedCampaigns[_campaign], "Campaign already denied");

        isApproved[_campaign] = true;
        emit CampaignApproved(_campaign);
    }

    /**
     * @notice Admin menolak kampanye.
     */
    function denyCampaign(address _campaign) external onlyAdmin {
        require(campaignToCreator[_campaign] != address(0), "Campaign not found");
        require(!isApproved[_campaign], "Campaign already approved");
        require(!deniedCampaigns[_campaign], "Already denied");

        deniedCampaigns[_campaign] = true;
        emit CampaignDenied(_campaign);
    }

    /**
     * @notice Mengembalikan semua alamat kampanye yang sudah disetujui.
     */
    function getApprovedCampaigns() external view returns (address[] memory result) {
        uint256 count;
        for (uint256 i = 0; i < campaigns.length; i++) {
            if (isApproved[campaigns[i]]) count++;
        }

        result = new address[](count);
        uint256 idx;
        for (uint256 i = 0; i < campaigns.length; i++) {
            if (isApproved[campaigns[i]]) {
                result[idx++] = campaigns[i];
            }
        }
    }

    /**
     * @notice Mengembalikan semua kampanye (pending, approved, denied).
     */
    function getAllCampaigns() external view returns (address[] memory) {
        return campaigns;
    }
}
