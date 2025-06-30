#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PLATFORMS = [
  'win32-x64-msvc',
  'darwin-x64',
  'linux-x64-gnu',
  'linux-x64-musl',
  'linux-arm64-gnu',
  'darwin-arm64',
  'linux-arm64-musl',
  'win32-arm64-msvc'
];

async function checkPackageExists(packageName, version) {
  try {
    execSync(`npm view ${packageName}@${version} version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function publishPlatformPackages() {
  const mainPackage = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const version = mainPackage.version;
  
  console.log(`Publishing platform packages for version ${version}...`);
  
  let allSuccess = true;
  
  for (const platform of PLATFORMS) {
    const packageName = `@pact-toolbox/pact-transformer-${platform}`;
    const packagePath = path.join('npm', platform);
    
    if (!fs.existsSync(packagePath)) {
      console.log(`Platform package ${platform} not found, skipping...`);
      continue;
    }
    
    if (await checkPackageExists(packageName, version)) {
      console.log(`Package ${packageName}@${version} already published, skipping...`);
      continue;
    }
    
    try {
      console.log(`Publishing ${packageName}...`);
      execSync(`npm publish ${packagePath} --access public`, { 
        stdio: 'inherit',
        cwd: process.cwd()
      });
      console.log(`Successfully published ${packageName}`);
    } catch (error) {
      console.error(`Failed to publish ${packageName}:`, error.message);
      allSuccess = false;
    }
  }
  
  return allSuccess;
}

async function publishMainPackage() {
  const mainPackage = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const version = mainPackage.version;
  const packageName = mainPackage.name;
  
  if (await checkPackageExists(packageName, version)) {
    console.log(`Main package ${packageName}@${version} already published, skipping...`);
    return true;
  }
  
  try {
    console.log(`Publishing main package ${packageName}...`);
    execSync('npm publish --access public', { stdio: 'inherit' });
    console.log(`Successfully published ${packageName}`);
    return true;
  } catch (error) {
    console.error(`Failed to publish main package:`, error.message);
    return false;
  }
}

async function main() {
  // Remove prepublishOnly to prevent automatic publishing
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (packageJson.scripts && packageJson.scripts.prepublishOnly) {
    delete packageJson.scripts.prepublishOnly;
    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');
  }
  
  // First publish platform packages
  const platformSuccess = await publishPlatformPackages();
  
  // Then publish main package
  const mainSuccess = await publishMainPackage();
  
  if (!platformSuccess || !mainSuccess) {
    console.error('Some packages failed to publish');
    process.exit(1);
  }
  
  console.log('All packages published successfully!');
}

main().catch(console.error);