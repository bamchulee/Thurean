import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/line/richmenu": ["./public/line-richmenu.png"],
    "/api/admin/config": ["./google-apps-script/Code.gs"],
  },
};

export default nextConfig;
