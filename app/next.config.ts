import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Autorise les appareils du réseau local (téléphones) à accéder aux
  // ressources du serveur de dev Next (HMR, etc.).
  allowedDevOrigins: process.env.ALLOWED_ORIGINS?.split(",") ?? [],
  env: {
    TARGET_DATE: process.env.TARGET_DATE,
  }
};

export default nextConfig;
