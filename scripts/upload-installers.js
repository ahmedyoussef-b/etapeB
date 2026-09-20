/**
 * upload-installers.js — Upload NexaFlow installateurs sur GitHub Releases
 *
 * Usage : node scripts/upload-installers.js
 *
 * Upload :
 *   - src-tauri/target/release/bundle/msi/NexaFlow_1.0.0_x64_fr-FR.msi
 *   - src-tauri/target/release/bundle/nsis/NexaFlow_1.0.0_x64-setup.exe
 *
 * Retourne les URLs de download (JSON sur stdout).
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

// Charger les variables d'environnement (.env.local)
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
    }
  }
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || "ahmedyoussef-b";
const GITHUB_REPO = process.env.GITHUB_REPO || "etapeB";

if (!GITHUB_TOKEN) {
  console.error("ERREUR : GITHUB_TOKEN manquant dans .env.local");
  process.exit(1);
}

const BUNDLE_DIR = path.join(__dirname, "..", "src-tauri", "target", "release", "bundle");
const INSTALLERS = [
  {
    file: path.join(BUNDLE_DIR, "msi", "NexaFlow_1.0.0_x64_fr-FR.msi"),
    label: "Windows MSI",
    assetName: "NexaFlow_1.0.0_x64_fr-FR.msi",
  },
  {
    file: path.join(BUNDLE_DIR, "nsis", "NexaFlow_1.0.0_x64-setup.exe"),
    label: "Windows NSIS",
    assetName: "NexaFlow_1.0.0_x64-setup.exe",
  },
];

function sha256(filePath) {
  const { createHash } = require("crypto");
  const content = fs.readFileSync(filePath);
  return createHash("sha256").update(content).digest("hex");
}

function githubRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data ? JSON.parse(data) : {});
        } else {
          reject(new Error(`GitHub API HTTP ${res.statusCode}: ${data.slice(0, 300)}`));
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getOrCreateRelease() {
  const getOptions = {
    hostname: "api.github.com",
    port: 443,
    path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
    method: "GET",
    headers: {
      "User-Agent": "NexaFlow-Uploader",
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
    },
  };

  try {
    const release = await githubRequest(getOptions);
    console.log(`  Release ID : ${release.id} (${release.tag_name})`);
    return release;
  } catch (e) {
    if (e.message.includes("404")) {
      console.log("  Aucun release existant → création de v1.0.0...");
      return createRelease();
    }
    throw e;
  }
}

async function createRelease() {
  const body = JSON.stringify({
    tag_name: "v1.0.0",
    name: "NexaFlow v1.0.0",
    body: "Release initiale - NexaFlow desktop (Windows MSI + NSIS).\n\n- Configuration Groq au premier lancement\n- Chat IA avec RAG Rust\n- Structure BDD locale",
    draft: false,
    prerelease: false,
  });

  const options = {
    hostname: "api.github.com",
    port: 443,
    path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`,
    method: "POST",
    headers: {
      "User-Agent": "NexaFlow-Uploader",
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
  };
  return githubRequest(options, body);
}

async function deleteExistingAsset(releaseId, assetName) {
  const options = {
    hostname: "api.github.com",
    port: 443,
    path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/${releaseId}/assets?per_page=100`,
    method: "GET",
    headers: {
      "User-Agent": "NexaFlow-Uploader",
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
    },
  };

  const assets = await githubRequest(options);
  for (const asset of assets) {
    if (asset.name === assetName) {
      console.log(`  Suppression ancien asset : ${asset.name}`);
      const delOptions = {
        hostname: "api.github.com",
        port: 443,
        path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/assets/${asset.id}`,
        method: "DELETE",
        headers: {
          "User-Agent": "NexaFlow-Uploader",
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
        },
      };
      await githubRequest(delOptions);
    }
  }
}

async function uploadAsset(releaseId, filePath, assetName) {
  const fileData = fs.readFileSync(filePath);
  const options = {
    hostname: "uploads.github.com",
    port: 443,
    path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/${releaseId}/assets?name=${encodeURIComponent(assetName)}`,
    method: "POST",
    headers: {
      "User-Agent": "NexaFlow-Uploader",
      Authorization: `token ${GITHUB_TOKEN}`,
      "Content-Type": "application/octet-stream",
      "Content-Length": fileData.length,
    },
  };
  return githubRequest(options, fileData);
}

async function main() {
  console.log("Récupération/création du release...");
  const release = await getOrCreateRelease();

  const results = [];
  for (const installer of INSTALLERS) {
    if (!fs.existsSync(installer.file)) {
      console.warn(`SKIP ${installer.label} : fichier introuvable`);
      continue;
    }

    const size = fs.statSync(installer.file).size;
    const hash = sha256(installer.file);

    console.log(`Upload ${installer.label} (${(size / 1024 / 1024).toFixed(1)} Mo)...`);

    try {
      await deleteExistingAsset(release.id, installer.assetName);
      const asset = await uploadAsset(release.id, installer.file, installer.assetName);
      console.log(`  OK : ${asset.browser_download_url}`);
      results.push({
        label: installer.label,
        url: asset.browser_download_url,
        size: size,
        sha256: hash,
        format: path.extname(installer.file).slice(1),
      });
    } catch (e) {
      console.error(`  ERREUR : ${e.message}`);
    }
  }

  console.log("\n--- URLs ---");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});