// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CharityRegistry
 * @dev On-chain escrow, NGO authorization, milestone proof-of-work governance, and donor tracking for AquaChain.
 */
contract CharityRegistry {
    enum MilestoneStatus { Pending, ProofSubmitted, Approved, Rejected, Disbursed }

    struct Milestone {
        string description;
        uint256 amount;
        string ipfsProofCID;
        MilestoneStatus status;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 votingDeadline;
    }

    struct Campaign {
        uint256 id;
        address payable ngoAddress;
        string ipfsMetaCID;       // Title, description, banner image on IPFS
        uint256 targetAmount;
        uint256 totalRaised;
        uint256 seedAdvancePct;
        bool seedClaimed;
        uint256 milestoneCount;
        bool isActive;
    }

    // Platform Access Control
    address public admin;
    mapping(address => bool) public isVerifiedNGO;

    // Global Registry State Variables
    uint256 public campaignCounter;
    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(uint256 => Milestone)) public milestones;
    mapping(uint256 => uint256) public escrowBalances;
    
    // Donor Tracking for Portfolio Dashboard
    mapping(uint256 => mapping(address => uint256)) public donorContributions; // campaignId => donor => amount
    mapping(address => uint256[]) public donorCampaignHistory;                  // donor => array of campaignIds
    mapping(address => mapping(uint256 => bool)) private hasTrackedCampaign;     // Prevents duplicate campaign IDs in history
    
    // Voting State: campaignId => milestoneId => donorAddress => hasVoted
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public hasVoted;

    // Events
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
    event NGOAuthorized(address indexed ngoAddress);
    event NGORevoked(address indexed ngoAddress);
    event CampaignCreated(uint256 indexed campaignId, address indexed ngo, uint256 targetAmount);
    event DonationReceived(uint256 indexed campaignId, address indexed donor, uint256 amount);
    event SeedAdvanceClaimed(uint256 indexed campaignId, address indexed ngo, uint256 amount);
    event ProofSubmitted(uint256 indexed campaignId, uint256 indexed milestoneId, string ipfsCID);
    event VoteCast(uint256 indexed campaignId, uint256 indexed milestoneId, address indexed voter, bool approve, uint256 weight);
    event MilestoneFinalized(uint256 indexed campaignId, uint256 indexed milestoneId, bool approved, uint256 amountDisbursed);

    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "AquaChain: Caller is not admin");
        _;
    }

    modifier onlyVerifiedNGO() {
        require(isVerifiedNGO[msg.sender], "AquaChain: Wallet is not a verified NGO");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    // --- ADMIN MANAGEMENT & AUTHORIZATION ---

    /// @dev Whitelists an NGO wallet address to allow campaign creation
    function authorizeNGO(address _ngoAddress) external onlyAdmin {
        require(_ngoAddress != address(0), "Invalid address");
        require(!isVerifiedNGO[_ngoAddress], "NGO already authorized");
        
        isVerifiedNGO[_ngoAddress] = true;
        emit NGOAuthorized(_ngoAddress);
    }

    /// @dev Revokes NGO authorization status
    function revokeNGO(address _ngoAddress) external onlyAdmin {
        require(isVerifiedNGO[_ngoAddress], "NGO not currently authorized");
        
        isVerifiedNGO[_ngoAddress] = false;
        emit NGORevoked(_ngoAddress);
    }

    /// @dev Transfers administrative privileges to a new address
    function transferAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "Invalid address");
        emit AdminTransferred(admin, _newAdmin);
        admin = _newAdmin;
    }

    // --- 1. CREATE CAMPAIGN (RESTRICTED TO VERIFIED NGOs) ---
    function createCampaign(
        string memory _ipfsMetaCID,
        uint256 _targetAmount,
        uint256 _seedAdvancePct,
        string[] memory _milestoneDescs,
        uint256[] memory _milestoneAmounts
    ) external onlyVerifiedNGO returns (uint256) {
        require(_milestoneDescs.length == _milestoneAmounts.length, "Mismatched milestone inputs");
        require(_milestoneDescs.length > 0, "At least one milestone is required");
        require(_targetAmount > 0, "Target must be > 0");
        require(_seedAdvancePct <= 50, "Seed advance cannot exceed 50%");
        uint256 seedBudget = _seedAdvanceAmount(_targetAmount, _seedAdvancePct);
        uint256 milestoneBudget;
        for (uint256 i = 0; i < _milestoneAmounts.length; i++) {
            require(_milestoneAmounts[i] > 0, "Milestone amount must be > 0");
            milestoneBudget += _milestoneAmounts[i];
        }
        require(milestoneBudget <= _targetAmount - seedBudget, "Campaign commitments exceed target");

        campaignCounter++;
        Campaign storage c = campaigns[campaignCounter];
        c.id = campaignCounter;
        c.ngoAddress = payable(msg.sender);
        c.ipfsMetaCID = _ipfsMetaCID;
        c.targetAmount = _targetAmount;
        c.seedAdvancePct = _seedAdvancePct;
        c.milestoneCount = _milestoneDescs.length;
        c.isActive = true;

        for (uint256 i = 0; i < _milestoneDescs.length; i++) {
            milestones[campaignCounter][i] = Milestone({
                description: _milestoneDescs[i],
                amount: _milestoneAmounts[i],
                ipfsProofCID: "",
                status: MilestoneStatus.Pending,
                yesVotes: 0,
                noVotes: 0,
                votingDeadline: 0
            });
        }

        emit CampaignCreated(campaignCounter, msg.sender, _targetAmount);
        return campaignCounter;
    }

    // --- 2. DONATE TO CAMPAIGN ---
    function donate(uint256 _campaignId) external payable {
        Campaign storage c = campaigns[_campaignId];
        require(c.isActive, "Campaign inactive");
        require(msg.value > 0, "Must donate POL");

        c.totalRaised += msg.value;
        escrowBalances[_campaignId] += msg.value;
        donorContributions[_campaignId][msg.sender] += msg.value;

        // Track campaign in donor's history array if first time donating
        if (!hasTrackedCampaign[msg.sender][_campaignId]) {
            donorCampaignHistory[msg.sender].push(_campaignId);
            hasTrackedCampaign[msg.sender][_campaignId] = true;
        }

        emit DonationReceived(_campaignId, msg.sender, msg.value);
    }

    // --- 3. CLAIM SEED ADVANCE (NGO) ---
    function claimSeedAdvance(uint256 _campaignId) external {
        Campaign storage c = campaigns[_campaignId];
        require(msg.sender == c.ngoAddress, "Not NGO");
        require(!c.seedClaimed, "Seed already claimed");
        uint256 seedAmount = _seedAdvanceAmount(c.targetAmount, c.seedAdvancePct);
        require(c.totalRaised >= seedAmount, "Target seed threshold not met");
        require(escrowBalances[_campaignId] >= seedAmount, "Insufficient campaign escrow");

        c.seedClaimed = true;
        escrowBalances[_campaignId] -= seedAmount;
        
        (bool success, ) = c.ngoAddress.call{value: seedAmount}("");
        require(success, "Transfer failed");

        emit SeedAdvanceClaimed(_campaignId, msg.sender, seedAmount);
    }

    // --- 4. SUBMIT PROOF (NGO) ---
    function submitProof(uint256 _campaignId, uint256 _milestoneId, string memory _ipfsCID) external {
        Campaign storage c = campaigns[_campaignId];
        require(msg.sender == c.ngoAddress, "Not NGO");
        require(_milestoneId < c.milestoneCount, "Milestone does not exist");
        if (_milestoneId > 0) {
            require(
                milestones[_campaignId][_milestoneId - 1].status == MilestoneStatus.Disbursed,
                "Previous milestone not disbursed"
            );
        }
        
        Milestone storage m = milestones[_campaignId][_milestoneId];
        require(m.status == MilestoneStatus.Pending, "Milestone not pending");

        m.ipfsProofCID = _ipfsCID;
        m.status = MilestoneStatus.ProofSubmitted;
        m.votingDeadline = block.timestamp + 1 days; // 24-hour voting window

        emit ProofSubmitted(_campaignId, _milestoneId, _ipfsCID);
    }

    // --- 5. DONOR VOTING ---
    function voteOnMilestone(uint256 _campaignId, uint256 _milestoneId, bool _approve) external {
        uint256 votingWeight = donorContributions[_campaignId][msg.sender];
        require(votingWeight > 0, "Only donors can vote");
        
        Milestone storage m = milestones[_campaignId][_milestoneId];
        require(m.status == MilestoneStatus.ProofSubmitted, "Voting not active");
        require(block.timestamp <= m.votingDeadline, "Voting deadline passed");
        require(!hasVoted[_campaignId][_milestoneId][msg.sender], "Already voted");

        hasVoted[_campaignId][_milestoneId][msg.sender] = true;

        if (_approve) {
            m.yesVotes += votingWeight;
        } else {
            m.noVotes += votingWeight;
        }

        emit VoteCast(_campaignId, _milestoneId, msg.sender, _approve, votingWeight);
    }

    // --- 6. FINALIZE MILESTONE & DISBURSE ---
    function finalizeMilestone(uint256 _campaignId, uint256 _milestoneId) external {
        Milestone storage m = milestones[_campaignId][_milestoneId];
        require(m.status == MilestoneStatus.ProofSubmitted, "Not in voting status");
        
        uint256 halfTotalRaised = campaigns[_campaignId].totalRaised / 2;
        require(
            block.timestamp > m.votingDeadline || m.yesVotes > halfTotalRaised,
            "Voting still active"
        );

        if (m.yesVotes > m.noVotes) {
            uint256 payoutAmount = m.amount;
            require(escrowBalances[_campaignId] >= payoutAmount, "Insufficient campaign escrow");
            m.status = MilestoneStatus.Disbursed;
            escrowBalances[_campaignId] -= payoutAmount;
            
            (bool success, ) = campaigns[_campaignId].ngoAddress.call{value: payoutAmount}("");
            require(success, "Payout transfer failed");

            emit MilestoneFinalized(_campaignId, _milestoneId, true, payoutAmount);
        } else {
            m.status = MilestoneStatus.Rejected;
            emit MilestoneFinalized(_campaignId, _milestoneId, false, 0);
        }
    }

    // --- VIEW HELPERS ---
    function getDonorCampaigns(address _donor) external view returns (uint256[] memory) {
        return donorCampaignHistory[_donor];
    }

    function getMilestone(uint256 _campaignId, uint256 _milestoneId) 
        external 
        view 
        returns (
            string memory description,
            uint256 amount,
            string memory ipfsProofCID,
            MilestoneStatus status,
            uint256 yesVotes,
            uint256 noVotes,
            uint256 votingDeadline
        ) 
    {
        Milestone storage m = milestones[_campaignId][_milestoneId];
        return (
            m.description,
            m.amount,
            m.ipfsProofCID,
            m.status,
            m.yesVotes,
            m.noVotes,
            m.votingDeadline
        );
    }

    function _seedAdvanceAmount(uint256 _targetAmount, uint256 _seedAdvancePct)
        private
        pure
        returns (uint256)
    {
        return (_targetAmount / 100) * _seedAdvancePct
            + ((_targetAmount % 100) * _seedAdvancePct) / 100;
    }
}
