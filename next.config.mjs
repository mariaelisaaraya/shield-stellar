/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias["@metamask/sdk"] = false;
    return config;
  },
};

export default nextConfig;
