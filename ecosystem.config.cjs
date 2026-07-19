const fs = require("fs");
const path = require("path");

/** Muat .env.local ke PM2 agar TELEGRAM_* tersedia saat runtime. */
function loadEnvFile(filename) {
  const filePath = path.join(__dirname, filename);
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const sapadarsiProductionEnv = loadEnvFile(".env.production");
const sapadarsiLocalEnv = loadEnvFile(".env.local");
const sapabidanProductionEnv = loadEnvFile("../sapabidan-frontend/.env.production");
const sapabidanLocalEnv = loadEnvFile("../sapabidan-frontend/.env.local");

/** Gabung env runtime; kunci variant selalu di akhir agar tidak tertimpa shell / file lain. */
function sapadarsiRuntimeEnv() {
  return {
    NODE_ENV: "production",
    ...sapadarsiProductionEnv,
    ...sapadarsiLocalEnv,
    NEXT_PUBLIC_APP_VARIANT: "sapadarsi",
    NEXT_PUBLIC_PUBLIC_BASE_URL: "https://sapadarsi.hcm-lab.id",
    DARSI_PUBLIC_URL: "https://sapadarsi.hcm-lab.id",
  };
}

function sapabidanRuntimeEnv() {
  return {
    NODE_ENV: "production",
    ...sapabidanProductionEnv,
    ...sapabidanLocalEnv,
    NEXT_PUBLIC_APP_VARIANT: "sapabidan",
    NEXT_PUBLIC_PUBLIC_BASE_URL: "https://sapabidan.labvr.unusa.ac.id",
    DARSI_PUBLIC_URL: "https://sapabidan.labvr.unusa.ac.id",
  };
}

module.exports = {
  apps: [
    {
      name: "darsi-frontend",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3030 -H 0.0.0.0",
      cwd: ".",
      env: sapadarsiRuntimeEnv(),
      watch: false,
      autorestart: true,
      max_restarts: 10,
    },
    {
      name: "sapabidan",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3031 -H 0.0.0.0",
      cwd: ".",
      env: sapabidanRuntimeEnv(),
      watch: false,
      autorestart: true,
      max_restarts: 10,
    },
  ],
};
