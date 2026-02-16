/** @type {import('next').NextConfig} */
const nextConfig = {
  // Proxy para evitar CORS
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://api-hubstg.lenderocapital.com/api/:path*',
      },
    ];
  },
  
  // Configuración de imágenes
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

module.exports = nextConfig;