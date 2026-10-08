/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    config.externals.push(
      'pino-pretty',
      'lokijs',
      'encoding',
      '@x402/evm',
      '@x402/svm',
      '@x402/svm/exact/client',
      '@x402/evm/exact/client',
      '@x402/evm/upto/client',
      '@x402/core/client'
    );
    
    // Proper way to ignore modules that cause syntax errors in externals
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@react-native-async-storage/async-storage': false,
      };
    }

    return config;
  },
};
export default nextConfig;
