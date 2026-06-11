/**
 * Génère un QR code (image PNG + affichage terminal) vers la page d'upload.
 *
 * Usage :
 *   npx tsx scripts/generate-qr.ts http://192.168.1.50:3000
 *
 * Remplace l'IP par l'adresse locale du laptop le jour J
 * (visible avec `ipconfig` sur Windows, section wifi du routeur portable).
 */
import QRCode from "qrcode";
import path from "path";

const url = process.argv[2];

if (!url) {
  console.error("Usage: npx tsx scripts/generate-qr.ts <url>");
  console.error("Exemple: npx tsx scripts/generate-qr.ts http://192.168.1.50:3000");
  process.exit(1);
}

async function main() {
  // Affichage dans le terminal (pratique pour vérifier rapidement)
  console.log(await QRCode.toString(url, { type: "terminal", small: true }));

  // Génération d'un PNG à imprimer/afficher
  const outPath = path.join(process.cwd(), "qrcode-acces.png");
  await QRCode.toFile(outPath, url, { width: 600, margin: 2 });
  console.log(`\nQR code généré : ${outPath}`);
  console.log(`URL encodée : ${url}`);
}

main();
