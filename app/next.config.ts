import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Autorise les appareils du réseau local (téléphones) à accéder aux
  // ressources du serveur de dev Next (HMR, etc.).
  allowedDevOrigins: ["10.0.0.70", "10.0.0.*"],
};

export default nextConfig;
