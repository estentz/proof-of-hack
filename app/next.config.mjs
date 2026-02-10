/** @type {import('next').NextConfig} */
const isStaticExport = process.env.STATIC_EXPORT === "true";

const nextConfig = {
  ...(isStaticExport && {
    output: "export",
    trailingSlash: true,
  }),
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    };
    // Handle pino-pretty missing module
    config.externals = [...(config.externals || []), "pino-pretty"];
    return config;
  },
};

export default nextConfig;
