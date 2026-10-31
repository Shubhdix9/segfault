/**
 * AquaChain Pinata IPFS Helper Module (Universal Browser & Node.js)
 * Handles uploading and fetching receipt photos, PDFs, and campaign metadata JSON to/from IPFS.
 */
(function(global) {
  const DEDICATED_GATEWAY =
    (typeof localStorage !== "undefined" && localStorage.getItem("aquachain_ipfs_gateway")) ||
    "https://gateway.pinata.cloud/ipfs";

  function getPinataJWT() {
    if (typeof localStorage !== "undefined" && localStorage.getItem("aquachain_pinata_jwt")) {
      return localStorage.getItem("aquachain_pinata_jwt");
    }
    try {
      if (typeof process !== "undefined" && process.env && process.env.PINATA_JWT) {
        return process.env.PINATA_JWT;
      }
    } catch(e) {}
    return "";
  }

  function getIPFSUrl(cid) {
    if (!cid) return "";
    if (cid.startsWith("http://") || cid.startsWith("https://")) return cid;
    const cleanCID = cid.replace(/^ipfs:\/\//, "").trim();
    return `${DEDICATED_GATEWAY}/${cleanCID}`;
  }

  async function uploadFileToIPFS(file, customName = "aquachain_asset") {
    const jwt = getPinataJWT();
    if (!jwt || jwt === "YOUR_PINATA_JWT_HERE") {
      console.warn("AquaChain Pinata: No live JWT provided. Generated simulated IPFS CID.");
      const mockCid = "bafybeic" + Math.random().toString(36).substring(2, 10) + "_" + (file.name || "receipt").replace(/[^a-zA-Z0-9._-]/g, "");
      return { cid: mockCid, url: getIPFSUrl(mockCid) };
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("pinataMetadata", JSON.stringify({
      name: customName,
      keyvalues: {
        platform: "AquaChain",
        uploadedAt: new Date().toISOString()
      }
    }));
    formData.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: formData
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Pinata File Upload Failed: ${err.error?.details || err.error || res.statusText}`);
    }

    const data = await res.json();
    return { cid: data.IpfsHash, url: getIPFSUrl(data.IpfsHash) };
  }

  async function uploadJSONToIPFS(metadataObj, campaignTitle = "Campaign") {
    const jwt = getPinataJWT();
    if (!jwt || jwt === "YOUR_PINATA_JWT_HERE") {
      console.warn("AquaChain Pinata: No live JWT provided. Generated simulated IPFS CID.");
      const mockCid = "bafybeimeta" + Math.random().toString(36).substring(2, 10);
      return { cid: mockCid, url: getIPFSUrl(mockCid) };
    }

    const payload = {
      pinataContent: metadataObj,
      pinataMetadata: {
        name: `AquaChain_Meta_${campaignTitle.replace(/\s+/g, "_")}`,
        keyvalues: { platform: "AquaChain", type: "campaign_metadata" }
      }
    };

    const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Pinata JSON Upload Failed: ${err.error?.details || err.error || res.statusText}`);
    }

    const data = await res.json();
    return { cid: data.IpfsHash, url: getIPFSUrl(data.IpfsHash) };
  }

  async function fetchJSONFromIPFS(cid) {
    if (!cid) throw new Error("Missing IPFS CID");
    const url = getIPFSUrl(cid);
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch(err) {
      console.warn("Direct IPFS Gateway fetch failed, trying public ipfs.io fallback:", err);
    }
    const clean = cid.replace(/^ipfs:\/\//, "").trim();
    const fallbackRes = await fetch(`https://ipfs.io/ipfs/${clean}`);
    if (!fallbackRes.ok) throw new Error(`Could not fetch IPFS CID ${cid}`);
    return await fallbackRes.json();
  }

  async function fetchFileFromIPFS(cid) {
    if (!cid) throw new Error("Missing IPFS CID");
    const url = getIPFSUrl(cid);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not fetch IPFS file for CID ${cid}`);
    return await res.blob();
  }

  const PinataIPFS = {
    getPinataJWT,
    getIPFSUrl,
    uploadFileToIPFS,
    uploadJSONToIPFS,
    fetchJSONFromIPFS,
    fetchFileFromIPFS,
    DEDICATED_GATEWAY
  };

  global.PinataIPFS = PinataIPFS;
  global.AquaIPFS = PinataIPFS;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = PinataIPFS;
  }
})(typeof window !== "undefined" ? window : globalThis);

