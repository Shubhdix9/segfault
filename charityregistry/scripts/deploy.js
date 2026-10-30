import hre from "hardhat";

async function main() {
    const { ethers } = hre;
    const [deployer] = await ethers.getSigners();

    console.log("\n========================================================");
    console.log("Deploying CharityRegistry with account:", deployer.address);
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", ethers.formatEther(balance), "POL");
    console.log("========================================================\n");

    // 1. Deploy Smart Contract
    const CharityRegistry = await ethers.getContractFactory("CharityRegistry");
    const registry = await CharityRegistry.deploy();
    await registry.waitForDeployment();

    const contractAddress = await registry.getAddress();
    console.log("✅ CharityRegistry deployed successfully!");
    console.log("👉 VITE_CONTRACT_ADDRESS=" + contractAddress);
    console.log("👉 VITE_ADMIN_ADDRESS=" + deployer.address);

    // 2. Auto-authorize deployer as demo NGO so you can create campaigns
    console.log("\nAuthorizing deployer wallet as Verified NGO...");
    const tx = await registry.authorizeNGO(deployer.address);
    await tx.wait();
    console.log("✅ Deployer wallet authorized as Verified NGO!");
    console.log("========================================================\n");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});