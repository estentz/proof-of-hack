import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
      <h1 className="text-5xl font-bold mb-4">
        <span className="text-green-400">Proof</span> of Hack
      </h1>
      <p className="text-xl text-gray-400 max-w-2xl mb-8">
        Trustless responsible disclosure with on-chain proof and accountability.
        White hats hash exploit proof to Solana, protocols verify privately,
        both sides have cryptographic accountability.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full mb-12">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="text-3xl mb-3">1</div>
          <h3 className="text-lg font-semibold text-green-400 mb-2">
            Hash &amp; Commit
          </h3>
          <p className="text-gray-400 text-sm">
            SHA-256 hash your exploit proof. The commitment goes on-chain
            immediately — immutable, timestamped proof you found it first.
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="text-3xl mb-3">2</div>
          <h3 className="text-lg font-semibold text-blue-400 mb-2">
            Encrypt &amp; Share
          </h3>
          <p className="text-gray-400 text-sm">
            NaCl box encrypt your proof with the protocol&apos;s public key. Only
            they can decrypt it. No middlemen, no trust required.
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="text-3xl mb-3">3</div>
          <h3 className="text-lg font-semibold text-purple-400 mb-2">
            Verify &amp; Resolve
          </h3>
          <p className="text-gray-400 text-sm">
            Protocol acknowledges, fixes, and pays. If they ghost you, reveal
            your proof publicly after the grace period. On-chain accountability.
          </p>
        </div>
      </div>

      <div className="flex gap-4">
        <Link
          href="/submit"
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition"
        >
          Submit Disclosure
        </Link>
        <Link
          href="/register"
          className="border border-gray-600 hover:border-gray-400 text-gray-300 px-6 py-3 rounded-lg font-semibold transition"
        >
          Register Protocol
        </Link>
        <Link
          href="/dashboard"
          className="border border-gray-600 hover:border-gray-400 text-gray-300 px-6 py-3 rounded-lg font-semibold transition"
        >
          View Dashboard
        </Link>
      </div>

      <div className="mt-16 text-sm text-gray-600">
        Built on Solana Devnet | Anchor 0.32.1 |{" "}
        <a
          href="https://github.com/estentz/proof-of-hack"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-500 hover:text-gray-300"
        >
          GitHub
        </a>
      </div>
    </div>
  );
}
