import type { Metadata } from "next";
import { Inter, Cormorant_Garamond, Space_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["300", "400", "600"],
});

const spaceMono = Space_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "TimeToCall — AI Phone Agent",
  description:
    "Hate making phone calls? We got you. AI calls on your behalf and reports back.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${cormorant.variable} ${spaceMono.variable} antialiased`}>
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-[20%] left-[10%] h-[600px] w-[600px] rounded-full bg-pink-200/30 blur-[120px]" />
          <div className="absolute top-[30%] -right-[10%] h-[500px] w-[500px] rounded-full bg-violet-200/25 blur-[120px]" />
          <div className="absolute -bottom-[10%] left-[30%] h-[500px] w-[500px] rounded-full bg-sky-200/25 blur-[120px]" />
          <div className="absolute -top-[5%] -right-[5%] h-[450px] w-[450px] rounded-full bg-amber-200/25 blur-[120px]" />
        </div>
        {children}
      </body>
    </html>
  );
}
