import fs from "fs";
import dotenv from "dotenv";

dotenv.config();
const envPath = ".env";
const pkgPath = "package.json";

function bumpVersion(ver) {
  const [major, minor, patch] = ver.split(".").map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const envLines = fs.readFileSync(envPath, "utf8").split("\n");

let appVersion = process.env.APP_VERSION || pkg.version;
appVersion = bumpVersion(appVersion);

// update .env
const updatedEnv = envLines.map((line) =>
  line.startsWith("APP_VERSION=") ? `APP_VERSION=${appVersion}` : line
);
fs.writeFileSync(envPath, updatedEnv.join("\n"));

// update package.json
pkg.version = appVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

console.log(`🔼 Bumped version to ${appVersion}`);
