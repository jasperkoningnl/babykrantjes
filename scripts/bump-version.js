#!/usr/bin/env node
// scripts/bump-version.js
// Automatisch versie-bump script voor Babykrant
// Usage: node scripts/bump-version.js [patch|minor|major]

const fs = require('fs');
const path = require('path');

const VERSION_FILE = path.join(__dirname, '../lib/version.ts');
const PACKAGE_FILE = path.join(__dirname, '../package.json');

// Parse command line arguments
const bumpType = process.argv[2] || 'patch'; // default to patch

if (!['patch', 'minor', 'major'].includes(bumpType)) {
  console.error('❌ Invalid bump type. Use: patch, minor, or major');
  process.exit(1);
}

// Read current version from version.ts
function getCurrentVersion() {
  const content = fs.readFileSync(VERSION_FILE, 'utf8');
  const match = content.match(/export const APP_VERSION = '(v\d+\.\d+\.\d+)'/);

  if (!match) {
    console.error('❌ Could not find APP_VERSION in version.ts');
    process.exit(1);
  }

  return match[1]; // e.g., 'v3.3.0'
}

// Bump version according to semantic versioning
function bumpVersion(version, type) {
  const versionWithoutV = version.substring(1); // remove 'v' prefix
  const [major, minor, patch] = versionWithoutV.split('.').map(Number);

  let newMajor = major;
  let newMinor = minor;
  let newPatch = patch;

  if (type === 'major') {
    newMajor += 1;
    newMinor = 0;
    newPatch = 0;
  } else if (type === 'minor') {
    newMinor += 1;
    newPatch = 0;
  } else if (type === 'patch') {
    newPatch += 1;
  }

  return `v${newMajor}.${newMinor}.${newPatch}`;
}

// Update version.ts
function updateVersionFile(newVersion) {
  let content = fs.readFileSync(VERSION_FILE, 'utf8');

  // Update APP_VERSION
  content = content.replace(
    /export const APP_VERSION = 'v\d+\.\d+\.\d+'/,
    `export const APP_VERSION = '${newVersion}'`
  );

  // Update APP_VERSION_FULL (keep the description part)
  content = content.replace(
    /export const APP_VERSION_FULL = 'v\d+\.\d+\.\d+([^']*)'/,
    `export const APP_VERSION_FULL = '${newVersion}$1'`
  );

  // Update RELEASE_DATE to today
  const today = new Date().toISOString().split('T')[0];
  content = content.replace(
    /export const RELEASE_DATE = '\d{4}-\d{2}-\d{2}'/,
    `export const RELEASE_DATE = '${today}'`
  );

  fs.writeFileSync(VERSION_FILE, content, 'utf8');
}

// Update package.json
function updatePackageJson(newVersion) {
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_FILE, 'utf8'));

  // Remove 'v' prefix for package.json (npm convention)
  packageJson.version = newVersion.substring(1);

  fs.writeFileSync(PACKAGE_FILE, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
}

// Main execution
try {
  const currentVersion = getCurrentVersion();
  const newVersion = bumpVersion(currentVersion, bumpType);

  console.log(`📦 Bumping version from ${currentVersion} to ${newVersion} (${bumpType})`);

  // Update files
  updateVersionFile(newVersion);
  updatePackageJson(newVersion);

  console.log('✅ Version updated successfully!');
  console.log(`   - lib/version.ts: ${newVersion}`);
  console.log(`   - package.json: ${newVersion.substring(1)}`);
  console.log('');
  console.log('💡 Next steps:');
  console.log('   1. Update RELEASE_NOTES in lib/version.ts with your changes');
  console.log('   2. Commit: git add . && git commit -m "chore: bump version to ' + newVersion + '"');
  console.log('   3. Push: git push');

} catch (error) {
  console.error('❌ Error bumping version:', error.message);
  process.exit(1);
}
