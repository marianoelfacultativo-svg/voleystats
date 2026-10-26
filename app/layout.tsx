import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SALIDAx5",
  description: "Estadísticas de vóley · SALIDAx5",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}