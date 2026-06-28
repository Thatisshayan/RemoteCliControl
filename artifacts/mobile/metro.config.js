const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Allow Metro to follow pnpm symlinks for workspace packages
config.resolver.unstable_enableSymlinks = true;

// Ensure TypeScript source files in workspace packages can be resolved
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  "mjs",
  "cjs",
];

// Don't bundle these heavy/native modules
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
