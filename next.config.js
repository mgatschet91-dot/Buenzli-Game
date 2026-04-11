const { withGTConfig } = require("gt-next/config");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  reactCompiler: true,
  // Setze das Root-Verzeichnis für Turbopack, um die Warnung zu vermeiden
  turbopack: {
    root: __dirname,
  },
};

module.exports = withGTConfig(nextConfig);