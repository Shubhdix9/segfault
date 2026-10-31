import { expect } from "chai";
import hre from "hardhat";

const { ethers, network } = hre;

describe("CharityRegistry Unit & Integration Tests", function () {
  let registry;
  let admin, ngo, donor1, donor2, stranger;

  beforeEach(async function () {
    [admin, ngo, donor1, donor2, stranger] = await ethers.getSigners();

    const CharityRegistryFactory = await ethers.getContractFactory("CharityRegistry");
    registry = await CharityRegistryFactory.deploy();
    await registry.waitForDeployment();
  });

  describe("1. Access Control & Authorization", function () {
    it("Should set the deployer as admin", async function () {
      expect(await registry.admin()).to.equal(admin.address);
    });

    it("Should prevent non-verified addresses from creating campaigns", async function () {
      const descs = ["Milestone 1 - Filters"];
      const amounts = [ethers.parseEther("1.0")];

      await expect(
        registry.connect(stranger).createCampaign("QmMeta123", ethers.parseEther("2.0"), 10, descs, amounts)
      ).to.be.revertedWith("WellChain: Wallet is not a verified NGO");
    });

    it("Should allow admin to authorize an NGO", async function () {
      await expect(registry.connect(admin).authorizeNGO(ngo.address))
        .to.emit(registry, "NGOAuthorized")
        .withArgs(ngo.address);

      expect(await registry.isVerifiedNGO(ngo.address)).to.be.true;
    });

    it("Should restrict NGO authorization changes to the admin", async function () {
      await expect(registry.connect(stranger).authorizeNGO(ngo.address))
        .to.be.revertedWith("WellChain: Caller is not admin");

      await registry.connect(admin).authorizeNGO(ngo.address);
      await expect(registry.connect(stranger).revokeNGO(ngo.address))
        .to.be.revertedWith("WellChain: Caller is not admin");

      await expect(registry.connect(admin).revokeNGO(ngo.address))
        .to.emit(registry, "NGORevoked")
        .withArgs(ngo.address);
      expect(await registry.isVerifiedNGO(ngo.address)).to.be.false;
    });
  });

  describe("2. Campaign Creation & Donations", function () {
    beforeEach(async function () {
      await registry.connect(admin).authorizeNGO(ngo.address);
    });

    it("Should allow verified NGO to create a campaign", async function () {
      const descs = ["M1: Procurement", "M2: Distribution"];
      const amounts = [ethers.parseEther("2.0"), ethers.parseEther("3.0")];

      await expect(
        registry.connect(ngo).createCampaign("QmMetaCID", ethers.parseEther("6.0"), 10, descs, amounts)
      )
        .to.emit(registry, "CampaignCreated")
        .withArgs(1, ngo.address, ethers.parseEther("6.0"));

      const c = await registry.campaigns(1);
      expect(c.ngoAddress).to.equal(ngo.address);
      expect(c.targetAmount).to.equal(ethers.parseEther("6.0"));
    });

    it("Should reject campaigns whose seed and milestone commitments exceed the target", async function () {
      await expect(
        registry.connect(ngo).createCampaign(
          "QmMetaCID",
          ethers.parseEther("5.0"),
          10,
          ["M1", "M2"],
          [ethers.parseEther("3.0"), ethers.parseEther("2.0")]
        )
      ).to.be.revertedWith("Campaign commitments exceed target");
    });

    it("Should reject campaigns without milestones", async function () {
      await expect(
        registry.connect(ngo).createCampaign("QmMetaCID", ethers.parseEther("5.0"), 0, [], [])
      ).to.be.revertedWith("At least one milestone is required");
    });

    it("Should record donations and track donor history", async function () {
      await registry.connect(ngo).createCampaign("QmMetaCID", ethers.parseEther("10.0"), 10, ["M1"], [ethers.parseEther("9.0")]);

      await registry.connect(donor1).donate(1, { value: ethers.parseEther("2.0") });
      await registry.connect(donor2).donate(1, { value: ethers.parseEther("3.0") });

      expect(await registry.donorContributions(1, donor1.address)).to.equal(ethers.parseEther("2.0"));
      expect(await registry.escrowBalances(1)).to.equal(ethers.parseEther("5.0"));

      const donor1History = await registry.getDonorCampaigns(donor1.address);
      expect(donor1History.length).to.equal(1);
      expect(donor1History[0]).to.equal(1n);
    });

    it("Should pay the fixed seed budget from only that campaign's escrow", async function () {
      await registry.connect(ngo).createCampaign(
        "QmMetaCID",
        ethers.parseEther("10.0"),
        20,
        ["M1"],
        [ethers.parseEther("8.0")]
      );
      await registry.connect(donor1).donate(1, { value: ethers.parseEther("3.0") });
      await registry.connect(ngo).claimSeedAdvance(1);

      expect(await registry.escrowBalances(1)).to.equal(ethers.parseEther("1.0"));
      expect(await ethers.provider.getBalance(registry.target)).to.equal(ethers.parseEther("1.0"));
    });
  });

  describe("3. Governance Voting & Escrow Disbursement", function () {
    beforeEach(async function () {
      await registry.connect(admin).authorizeNGO(ngo.address);
      await registry.connect(ngo).createCampaign(
        "QmMetaCID",
        ethers.parseEther("10.0"),
        10,
        ["M1 - Equipment"],
        [ethers.parseEther("5.0")]
      );

      await registry.connect(donor1).donate(1, { value: ethers.parseEther("6.0") });
      await registry.connect(donor2).donate(1, { value: ethers.parseEther("4.0") });
    });

    it("Should allow NGO to submit proof and start 24h voting window", async function () {
      await expect(registry.connect(ngo).submitProof(1, 0, "QmProofCID123"))
        .to.emit(registry, "ProofSubmitted")
        .withArgs(1, 0, "QmProofCID123");

      const m = await registry.getMilestone(1, 0);
      expect(m.status).to.equal(1);
    });

    it("Should prevent submitting a later milestone before the earlier payout is disbursed", async function () {
      await registry.connect(ngo).createCampaign(
        "QmMetaCID",
        ethers.parseEther("10.0"),
        0,
        ["M1", "M2"],
        [ethers.parseEther("4.0"), ethers.parseEther("4.0")]
      );

      await expect(
        registry.connect(ngo).submitProof(2, 1, "QmProofCID123")
      ).to.be.revertedWith("Previous milestone not disbursed");
      await expect(
        registry.connect(ngo).submitProof(2, 2, "QmProofCID123")
      ).to.be.revertedWith("Milestone does not exist");
    });

    it("Should not let a campaign spend another campaign's escrow", async function () {
      await registry.connect(ngo).createCampaign(
        "QmOtherMetaCID",
        ethers.parseEther("10.0"),
        0,
        ["M1"],
        [ethers.parseEther("5.0")]
      );
      await registry.connect(donor1).donate(2, { value: ethers.parseEther("2.0") });
      await registry.connect(donor2).donate(1, { value: ethers.parseEther("10.0") });
      await registry.connect(ngo).submitProof(2, 0, "QmProofCID123");
      await registry.connect(donor1).voteOnMilestone(2, 0, true);

      await expect(
        registry.connect(stranger).finalizeMilestone(2, 0)
      ).to.be.revertedWith("Insufficient campaign escrow");
      expect(await registry.escrowBalances(2)).to.equal(ethers.parseEther("2.0"));
      expect((await registry.getMilestone(2, 0)).status).to.equal(1);
    });

    it("Should weigh votes by contribution and disburse payout on approval", async function () {
      await registry.connect(ngo).submitProof(1, 0, "QmProofCID123");

      await registry.connect(donor1).voteOnMilestone(1, 0, true);
      await registry.connect(donor2).voteOnMilestone(1, 0, false);

      const mBefore = await registry.getMilestone(1, 0);
      expect(mBefore.yesVotes).to.equal(ethers.parseEther("6.0"));
      expect(mBefore.noVotes).to.equal(ethers.parseEther("4.0"));

      await network.provider.send("evm_increaseTime", [86401]);
      await network.provider.send("evm_mine");

      const ngoBalBefore = await ethers.provider.getBalance(ngo.address);
      await registry.connect(stranger).finalizeMilestone(1, 0);
      const ngoBalAfter = await ethers.provider.getBalance(ngo.address);

      expect(ngoBalAfter - ngoBalBefore).to.equal(ethers.parseEther("5.0"));

      const mAfter = await registry.getMilestone(1, 0);
      expect(mAfter.status).to.equal(4);
      expect(await registry.escrowBalances(1)).to.equal(ethers.parseEther("5.0"));
    });

    it("Should reject disbursement if NO votes outnumber YES votes", async function () {
      await registry.connect(ngo).submitProof(1, 0, "QmProofCID123");

      await registry.connect(donor1).voteOnMilestone(1, 0, false);
      await registry.connect(donor2).voteOnMilestone(1, 0, true);

      await network.provider.send("evm_increaseTime", [86401]);
      await network.provider.send("evm_mine");

      await registry.connect(stranger).finalizeMilestone(1, 0);

      const mAfter = await registry.getMilestone(1, 0);
      expect(mAfter.status).to.equal(3);
    });
  });
});
