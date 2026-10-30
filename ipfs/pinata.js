/**
 * AquaChain Pinata IPFS Helper Module
 * Handles uploading and fetching high-res receipt photos, banner images, and campaign metadata JSON to/from IPFS.
 */

// Reads Pinata JWT from localStorage, environment, or default
export function getPinataJWT() {
    if (typeof localStorage !== "undefined" && localStorage.getItem("aquachain_pinata_jwt")) {
        return localStorage.getItem("aquachain_pinata_jwt");
    }
    try {
        if (typeof process !== "undefined" && process.env?.PINATA_JWT) {
            return process.env.PINATA_JWT;
        }
    } catch(e) {}
    return "YOUR_PINATA_JWT_HERE";
}

export const DEDICATED_GATEWAY =
    (typeof localStorage !== "undefined" && localStorage.getItem("aquachain_ipfs_gateway")) ||
    "https://gateway.pinata.cloud/ipfs";

/**
 * Resolves an IPFS CID to a browser-viewable HTTP Gateway URL
 * @param {string} cid - IPFS CID hash
 * @returns {string} HTTP Gateway URL
 */
export function getIPFSUrl(cid) {
    if (!cid) return "";
    if (cid.startsWith("http://") || cid.startsWith("https://")) return cid;
    const cleanCID = cid.replace(/^ipfs:\/\//, "").trim();
    return `${DEDICATED_GATEWAY}/${cleanCID}`;
}

/**
 * Uploads a file (Receipt PDF/Image, Banner) to Pinata IPFS
 * @param {File | Blob} file - The file object to upload
 * @param {string} customName - Optional name for display in Pinata dashboard
 * @returns {Promise<{ cid: string, url: string }>} IPFS CID and HTTP Gateway URL
 */
export async function uploadFileToIPFS(file, customName = "aquachain_asset") {
    const jwt = getPinataJWT();
    if (!jwt || jwt === "YOUR_PINATA_JWT_HERE") {
        console.warn("AquaChain Pinata: Missing PINATA_JWT token. Generating local CID.");
        const mockCid = "bafybeic" + Math.random().toString(36).substring(2, 10) + "_" + (file.name || "receipt").replace(/[^a-zA-Z0-9._-]/g, "");
        return { cid: mockCid, url: getIPFSUrl(mockCid) };
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
            Authorization: `Bearer ${jwt}`,
        },
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Pinata File Upload Failed: ${errorData.error?.details || errorData.error || response.statusText}`);
    }

    const result = await response.json();
    const cid = result.IpfsHash;

    return {
        cid,
        url: getIPFSUrl(cid),
    };
}

/**
 * Uploads Campaign Metadata JSON to Pinata IPFS
 * @param {Object} metadataObj - Structured campaign metadata
 * @param {string} campaignTitle - Campaign title for dashboard identification
 * @returns {Promise<{ cid: string, url: string }>} IPFS CID and HTTP Gateway URL
 */
export async function uploadJSONToIPFS(metadataObj, campaignTitle = "Campaign") {
    const jwt = getPinataJWT();
    if (!jwt || jwt === "YOUR_PINATA_JWT_HERE") {
        console.warn("AquaChain Pinata: Missing PINATA_JWT token. Generating local CID.");
        const mockCid = "bafybeimeta" + Math.random().toString(36).substring(2, 10);
        return { cid: mockCid, url: getIPFSUrl(mockCid) };
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
            Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Pinata JSON Upload Failed: ${errorData.error?.details || errorData.error || response.statusText}`);
    }

    const result = await response.json();
    const cid = result.IpfsHash;

    return {
        cid,
        url: getIPFSUrl(cid),
    };
}

/**
 * Fetches JSON metadata from IPFS via the Pinata Gateway
 * @param {string} cid - IPFS CID hash
 * @returns {Promise<Object>} The parsed JSON data from IPFS
 */
export async function fetchJSONFromIPFS(cid) {
    if (!cid) throw new Error("Missing IPFS CID");
    const url = getIPFSUrl(cid);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch IPFS CID ${cid}: ${response.statusText}`);
    }
    return await response.json();
}

/**
 * Fetches raw file blob from IPFS via the Pinata Gateway
 * @param {string} cid - IPFS CID hash
 * @returns {Promise<Blob>} The file blob
 */
export async function fetchFileFromIPFS(cid) {
    if (!cid) throw new Error("Missing IPFS CID");
    const url = getIPFSUrl(cid);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch IPFS file for CID ${cid}: ${response.statusText}`);
    }
    return await response.blob();
}

// Universal browser export
if (typeof window !== "undefined") {
    window.PinataIPFS = {
        getPinataJWT,
        getIPFSUrl,
        uploadFileToIPFS,
        uploadJSONToIPFS,
        fetchJSONFromIPFS,
        fetchFileFromIPFS,
        DEDICATED_GATEWAY,
    };
    window.AquaIPFS = window.PinataIPFS;
}
