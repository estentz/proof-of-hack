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

      <h2 className="text-2xl font-bold mb-6">Who are you?</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full mb-12">
        <Link
          href="/submit"
          className="bg-gray-900 border border-green-800 hover:border-green-500 rounded-lg p-6 transition group"
        >
          <div className="text-3xl mb-3 group-hover:scale-110 transition">
            &#128269;
          </div>
          <h3 className="text-lg font-semibold text-green-400 mb-2">
            I Found a Bug
          </h3>
          <p className="text-gray-400 text-sm">
            Submit a disclosure with SHA-256 proof commitment. Optionally
            encrypt it for the protocol. Set a grace period for accountability.
          </p>
        </Link>
        <Link
          href="/register"
          className="bg-gray-900 border border-blue-800 hover:border-blue-500 rounded-lg p-6 transition group"
        >
          <div className="text-3xl mb-3 group-hover:scale-110 transition">
            &#128737;
          </div>
          <h3 className="text-lg font-semibold text-blue-400 mb-2">
            I Run a Protocol
          </h3>
          <p className="text-gray-400 text-sm">
            Register your program to receive encrypted disclosures. Acknowledge,
            triage, resolve, and pay bounties — all on-chain.
          </p>
        </Link>
        <a
          href="/skill.md"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-gray-900 border border-purple-800 hover:border-purple-500 rounded-lg p-6 transition group"
        >
          <div className="text-3xl mb-3 group-hover:scale-110 transition">
            &#129302;
          </div>
          <h3 className="text-lg font-semibold text-purple-400 mb-2">
            I&apos;m an Agent
          </h3>
          <p className="text-gray-400 text-sm">
            Integrate via skill.md, skill.json, or the TypeScript SDK. REST API
            available at /api/disclosures and /api/protocols.
          </p>
        </a>
      </div>

      <div className="flex gap-4 mb-8">
        <Link
          href="/dashboard"
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition"
        >
          View Dashboard
        </Link>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 max-w-md">
        <p className="text-xs text-gray-500 font-mono">
          Program: 4uYHTy...WTQAn
        </p>
        <p className="text-xs text-gray-500">
          Solana Devnet | Anchor 0.32.1 |{" "}
          <a
            href="https://github.com/estentz/proof-of-hack"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-gray-200"
          >
            GitHub
          </a>
          {" | "}
          <a
            href="/skill.json"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-gray-200"
          >
            skill.json
          </a>
        </p>
      </div>
    </div>
  );
}
