/**
 * AquaChain Pinata IPFS Helper Module
 * Handles uploading high-res receipt photos, banner images, and campaign metadata JSON to IPFS.
 *
 * !! ALERT UNTESTED !!
 * This does not currently reside the directory. When the frontend is implemented, this can be integrated and tested
 */

// Reads Pinata JWT from Vite environment variable or Node process.env
const PINATA_JWT =
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_PINATA_JWT) ||
      (typeof process !== "undefined" && process.env?.PINATA_JWT) ||
      "YOUR_PINATA_JWT_HERE";

const DEDICATED_GATEWAY =
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_PINATA_GATEWAY) ||
      "https://gateway.pinata.cloud/ipfs";

/**
 * Uploads a file (Receipt PDF/Image, Banner) to Pinata IPFS
 * @param {File | Blob} file - The file object to upload
 * @param {string} customName - Optional name for display in Pinata dashboard
 * @returns {Promise<{ cid: string, url: string }>} IPFS CID and HTTP Gateway URL
 */
export async function uploadFileToIPFS(file, customName = "aquachain_asset") {
    if (!PINATA_JWT || PINATA_JWT === "YOUR_PINATA_JWT_HERE") {
	throw new Error("AquaChain Pinata: Missing PINATA_JWT token in environment.");
    }

    const formData = new FormData();
    formData.append("file", file);

    const metadata = JSON.stringify({
	name: customName,
	keyvalues: {
	    platform: "AquaChain",
	    uploadedAt: new Date().toISOString(),
	},
    });
    formData.append("pinataMetadata", metadata);

    const options = JSON.stringify({
	cidVersion: 1,
    });
    formData.append("pinataOptions", options);

    const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
	method: "POST",
	headers: {
	    Authorization: `Bearer ${PINATA_JWT}`,
	},
	body: formData,
    });

    if (!response.ok) {
	const errorData = await response.json();
	throw new Error(`Pinata File Upload Failed: ${errorData.error || response.statusText}`);
    }

    const result = await response.json();
    const cid = result.IpfsHash;

    return {
	cid,
	url: `${DEDICATED_GATEWAY}/${cid}`,
    };
}

/**
 * Uploads Campaign Metadata JSON to Pinata IPFS
 * @param {Object} metadataObj - Structured campaign metadata
 * @param {string} campaignTitle - Campaign title for dashboard identification
 * @returns {Promise<{ cid: string, url: string }>} IPFS CID and HTTP Gateway URL
 */
export async function uploadJSONToIPFS(metadataObj, campaignTitle = "Campaign") {
    if (!PINATA_JWT || PINATA_JWT === "YOUR_PINATA_JWT_HERE") {
	throw new Error("AquaChain Pinata: Missing PINATA_JWT token in environment.");
    }

    const payload = {
	pinataContent: metadataObj,
	pinataMetadata: {
	    name: `AquaChain_Meta_${campaignTitle.replace(/\s+/g, "_")}`,
	    keyvalues: {
		platform: "AquaChain",
		type: "campaign_metadata",
	    },
	},
    };

    const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
	method: "POST",
	headers: {
	    "Content-Type": "application/json",
	    Authorization: `Bearer ${PINATA_JWT}`,
	},
	body: JSON.stringify(payload),
    });

    if (!response.ok) {
	const errorData = await response.json();
	throw new Error(`Pinata JSON Upload Failed: ${errorData.error || response.statusText}`);
    }

    const result = await response.json();
    const cid = result.IpfsHash;

    return {
	cid,
	url: `${DEDICATED_GATEWAY}/${cid}`,
    };
}

/**
 * Resolves an IPFS CID to a browser-viewable HTTP Gateway URL
 * @param {string} cid - IPFS CID hash
 * @returns {string} HTTP Gateway URL
 */
export function getIPFSUrl(cid) {
    if (!cid) return "";
    if (cid.startsWith("http://") || cid.startsWith("https://")) return cid;
    const cleanCID = cid.replace("ipfs://", "");
    return `${DEDICATED_GATEWAY}/${cleanCID}`;
}
