// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAdminManager {
    function isAdmin(address _addr) external view returns (bool);
}

/**
 * @title DonationCampaign
 * @notice Kontrak individual untuk setiap kampanye donasi.
 *         Mendukung donasi, sistem withdraw dengan persetujuan admin,
 *         dan fitur refund proporsional ketika kampanye gagal atau dibatalkan.
 *
 *         Refund proporsional:
 *           lossPercent   = totalWithdrawn / totalDonated
 *           refundDonor   = donorTotal[donor] × (totalDonated - totalWithdrawn) / totalDonated
 *
 *         Artinya semua donor menanggung kerugian secara adil sesuai porsi donasi
 *         mereka, bukan siapa cepat dia untung.
 */
contract DonationCampaign {
    // ─── State ───────────────────────────────────────────────────────────────
    string  public title;
    string  public description;
    string  public image;
    uint256 public goal;
    uint256 public totalDonated;
    uint256 public totalWithdrawn;   // ← tracking total yang sudah ditarik creator
    address public creator;
    string  public location;
    uint256 public deadline;
    string  public social;
    address public adminContract;
    bool    public cancelled;

    // ─── Donasi ──────────────────────────────────────────────────────────────
    struct Donation {
        address donor;
        uint256 amount;
    }
    Donation[] private _donations;

    // Total yang didonasikan per alamat (jumlah real, belum dikurangi kerugian)
    mapping(address => uint256) public donorTotal;

    // Daftar donor unik (untuk refundAll)
    address[] private _uniqueDonors;
    mapping(address => bool) private _isDonor;

    // ─── Withdraw Request ────────────────────────────────────────────────────
    // status: 0 = Pending, 1 = Approved, 2 = Finalized (executed ATAU denied)
    struct WithdrawRequest {
        uint256 amount;
        string  reason;
        uint256 timestamp;
        uint8   status;
    }
    WithdrawRequest[] public requests;

    // ─── Refund ──────────────────────────────────────────────────────────────
    mapping(address => bool) public refundClaimed;

    // ─── Events ──────────────────────────────────────────────────────────────
    event Donated(address indexed donor, uint256 amount);
    event WithdrawRequested(uint256 indexed id, uint256 amount, string reason);
    event WithdrawExecuted(uint256 id, uint256 amount);
    event WithdrawDenied(uint256 id);
    event Refunded(address indexed donor, uint256 amount);
    event CampaignCancelled();

    // ─── Modifiers ───────────────────────────────────────────────────────────
    modifier onlyCreator() {
        require(msg.sender == creator, "Only creator");
        _;
    }

    modifier onlyAdmin() {
        require(IAdminManager(adminContract).isAdmin(msg.sender), "Only admin");
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor(
        string memory _title,
        string memory _desc,
        string memory _image,
        uint256 _goal,
        string memory _location,
        uint256 _duration,
        string memory _social,
        address _creator,
        address _adminContract
    ) {
        require(_goal > 0, "Goal must be > 0");
        require(_duration > 0, "Duration must be > 0");
        require(_creator != address(0), "Invalid creator");
        require(_adminContract != address(0), "Invalid admin contract");

        title         = _title;
        description   = _desc;
        image         = _image;
        goal          = _goal;
        location      = _location;
        deadline      = block.timestamp + _duration;
        social        = _social;
        creator       = _creator;
        adminContract = _adminContract;
    }

    // ─── Donasi ──────────────────────────────────────────────────────────────

    function donate() external payable {
        require(!cancelled, "Campaign cancelled");
        require(block.timestamp <= deadline, "Campaign has ended");
        require(totalDonated < goal, "Funding goal already reached");
        require(msg.value > 0, "Donation must be > 0");

        _donations.push(Donation(msg.sender, msg.value));
        donorTotal[msg.sender] += msg.value;
        totalDonated += msg.value;

        if (!_isDonor[msg.sender]) {
            _isDonor[msg.sender] = true;
            _uniqueDonors.push(msg.sender);
        }

        emit Donated(msg.sender, msg.value);
    }

    function getDonations() external view returns (Donation[] memory) {
        return _donations;
    }

    // ─── Withdraw ────────────────────────────────────────────────────────────

    function requestWithdraw(uint256 _amount, string calldata _reason) external onlyCreator {
        require(!isRefundable(), "Refund mode: withdraw not allowed");
        require(_amount > 0, "Amount must be > 0");
        require(_amount <= address(this).balance, "Insufficient contract balance");

        requests.push(WithdrawRequest({
            amount:    _amount,
            reason:    _reason,
            timestamp: block.timestamp,
            status:    0
        }));

        emit WithdrawRequested(requests.length - 1, _amount, _reason);
    }

    function approveWithdraw(uint256 _id) external onlyAdmin {
        require(_id < requests.length, "Invalid request id");
        require(requests[_id].status == 0, "Request is not pending");

        requests[_id].status = 1;
    }

    function denyWithdraw(uint256 _id) external onlyAdmin {
        require(_id < requests.length, "Invalid request id");
        require(requests[_id].status == 0, "Request is not pending");

        requests[_id].status = 2;
        emit WithdrawDenied(_id);
    }

    function executeWithdraw(uint256 _id) external onlyCreator {
        require(_id < requests.length, "Invalid request id");
        require(requests[_id].status == 1, "Request is not approved");
        require(requests[_id].amount <= address(this).balance, "Insufficient balance");

        uint256 amount = requests[_id].amount;
        requests[_id].status = 2;
        totalWithdrawn += amount;   // ← catat berapa yang sudah ditarik

        (bool ok, ) = payable(creator).call{value: amount}("");
        require(ok, "ETH transfer failed");

        emit WithdrawExecuted(_id, amount);
    }

    // ─── Refund ──────────────────────────────────────────────────────────────

    /**
     * @notice Cek apakah kampanye memenuhi syarat refund.
     */
    function isRefundable() public view returns (bool) {
        return cancelled || (block.timestamp > deadline && totalDonated < goal);
    }

    /**
     * @notice Hitung jumlah refund proporsional untuk satu donor.
     *
     *   sisa di kontrak     = totalDonated - totalWithdrawn
     *   kerugian bersama x% = totalWithdrawn / totalDonated
     *   refundDonor         = donorTotal[donor] × (totalDonated - totalWithdrawn) / totalDonated
     *
     * @param donor Alamat donor yang ingin dicek
     * @return Jumlah ETH (wei) yang bisa diklaim donor tersebut
     */
    function refundAmountFor(address donor) public view returns (uint256) {
        if (totalDonated == 0) return 0;
        if (refundClaimed[donor]) return 0;
        uint256 remaining = totalDonated - totalWithdrawn;
        return (donorTotal[donor] * remaining) / totalDonated;
    }

    /**
     * @notice Donor mengklaim refund secara individual (pull pattern).
     *         Jumlah yang dikembalikan proporsional — menanggung kerugian bersama
     *         sesuai persentase dana yang sudah ditarik creator.
     */
    function claimRefund() external {
        require(isRefundable(), "Campaign is not refundable");
        require(donorTotal[msg.sender] > 0, "No donation to refund");
        require(!refundClaimed[msg.sender], "Refund already claimed");

        uint256 amount = refundAmountFor(msg.sender);
        require(amount > 0, "Nothing left to refund");

        // Tandai claimed dan nol-kan dulu (cegah reentrancy)
        refundClaimed[msg.sender] = true;
        donorTotal[msg.sender] = 0;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "ETH transfer failed");

        emit Refunded(msg.sender, amount);
    }

    /**
     * @notice Refund semua donor sekaligus (push pattern).
     *         Dipanggil admin ketika kampanye bermasalah.
     *
     *         Proporsi dihitung dari snapshot (totalDonated - totalWithdrawn)
     *         sebelum loop dimulai agar konsisten untuk semua donor.
     *
     *         FIX: refundClaimed hanya di-set true SETELAH transfer berhasil,
     *         sehingga donor tidak kehilangan haknya jika transfer gagal.
     */
    function refundAll() external {
        require(
            IAdminManager(adminContract).isAdmin(msg.sender) || msg.sender == creator,
            "Only admin or creator"
        );
        require(isRefundable(), "Campaign is not refundable");
        require(address(this).balance > 0, "Nothing to refund");
        require(totalDonated > 0, "No donations recorded");

        // Snapshot sisa dana sebelum loop — tidak berubah meski balance berkurang
        uint256 remaining = totalDonated - totalWithdrawn;
        require(remaining > 0, "All funds already withdrawn");

        for (uint256 i = 0; i < _uniqueDonors.length; i++) {
            address donor = _uniqueDonors[i];

            if (donorTotal[donor] == 0 || refundClaimed[donor]) continue;

            // Hitung refund proporsional per donor
            uint256 refundAmt = (donorTotal[donor] * remaining) / totalDonated;
            if (refundAmt == 0) continue;

            // FIX: set state SEBELUM transfer (cegah reentrancy),
            // tapi emit dan tandai hanya jika transfer sukses
            uint256 donorAmount = donorTotal[donor];
            refundClaimed[donor] = true;
            donorTotal[donor] = 0;

            (bool ok, ) = payable(donor).call{value: refundAmt}("");
            if (ok) {
                emit Refunded(donor, refundAmt);
            } else {
                // Transfer gagal → kembalikan state agar donor bisa claimRefund manual
                refundClaimed[donor] = false;
                donorTotal[donor] = donorAmount;
            }
        }
    }

    /**
     * @notice Admin membatalkan kampanye, mengaktifkan mode refund.
     */
    function cancelCampaign() external onlyAdmin {
        require(!cancelled, "Already cancelled");
        cancelled = true;
        emit CampaignCancelled();
    }

    /**
     * @notice Jumlah donor unik (untuk estimasi gas refundAll).
     */
    function getDonorCount() external view returns (uint256) {
        return _uniqueDonors.length;
    }
}
