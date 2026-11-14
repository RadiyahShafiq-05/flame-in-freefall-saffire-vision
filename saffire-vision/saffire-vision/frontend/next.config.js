const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:8000"; // server-side only, set via env
module.exports = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND}/api/:path*` },
            { source: "/outputs/:path*", destination: `${BACKEND}/outputs/:path*` }];
  },
};
