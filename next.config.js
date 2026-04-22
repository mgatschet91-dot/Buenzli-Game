const { withGTConfig } = require("gt-next/config");

const isElectronBuild = process.env.ELECTRON_BUILD === 'true';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  reactCompiler: true,
  turbopack: {
    root: __dirname,
  },
  ...(isElectronBuild ? { output: 'standalone' } : {}),
};

module.exports = withGTConfig(nextConfig);