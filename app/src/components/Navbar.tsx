"use client";

import Link from "next/link";
import dynamic from "next/dynamic";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
  { ssr: false }
);

export default function Navbar() {
  return (
    <nav className="border-b border-gray-800 bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-xl font-bold text-green-400">
              Proof of Hack
            </Link>
            <div className="hidden md:flex space-x-6">
              <Link
                href="/register"
                className="text-gray-300 hover:text-white transition"
              >
                Register Protocol
              </Link>
              <Link
                href="/submit"
                className="text-gray-300 hover:text-white transition"
              >
                Submit Disclosure
              </Link>
              <Link
                href="/dashboard"
                className="text-gray-300 hover:text-white transition"
              >
                Dashboard
              </Link>
            </div>
          </div>
          <WalletMultiButton />
        </div>
      </div>
    </nav>
  );
}
