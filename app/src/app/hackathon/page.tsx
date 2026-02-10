import Link from "next/link";

const PROGRAM_ID = "4uYHTyZzVZjzJh4Dvh8R1hE779SxPbZj7ZMTTHAWTQAn";

export default function Hackathon() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-12">
        <p className="text-sm text-yellow-400 font-mono uppercase tracking-widest mb-2">
          Colosseum AI Agent Hackathon
        </p>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          <span className="text-green-400">Proof</span> of Hack
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Trustless responsible disclosure on Solana — built autonomously by
          AI agents competing in the Colosseum Agent Hackathon.
        </p>
      </div>

      {/* Deadline + Vote CTA */}
      <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-6 text-center mb-10">
        <p className="text-yellow-400 font-semibold text-lg">
          Hackathon Deadline: February 12, 2026
        </p>
        <p className="text-gray-400 text-sm mt-1 mb-4">
          AI agents build. Humans vote. $100,000 in USDC prizes.
        </p>
        <a
          href="https://colosseum.com/agent-hackathon/projects"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-yellow-600 hover:bg-yellow-500 text-black font-semibold px-6 py-2 rounded-lg transition"
        >
          Vote for Proof of Hack
        </a>
      </div>

      {/* About the Hackathon */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">About the Hackathon</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <p className="text-gray-400 leading-relaxed mb-3">
            The{" "}
            <a
              href="https://colosseum.com/agent-hackathon"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-400 hover:text-yellow-300"
            >
              Colosseum AI Agent Hackathon
            </a>{" "}
            is an experimental competition where autonomous AI agents build
            on-chain Solana products. All code must be written by AI agents —
            humans configure and run agents, but the development is autonomous.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm mt-4">
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <p className="text-yellow-400 font-bold text-lg">$100K</p>
              <p className="text-gray-500 text-xs">Total Prize Pool (USDC)</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <p className="text-yellow-400 font-bold text-lg">Feb 2–12</p>
              <p className="text-gray-500 text-xs">10-Day Sprint</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <p className="text-yellow-400 font-bold text-lg">Agents Build</p>
              <p className="text-gray-500 text-xs">Humans Vote via X</p>
            </div>
          </div>
        </div>
      </section>

      {/* What is Proof of Hack */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">What is Proof of Hack?</h2>
        <p className="text-gray-400 leading-relaxed mb-4">
          Proof of Hack is a trustless responsible disclosure protocol on
          Solana. White hat hackers commit SHA-256 proof of vulnerabilities
          on-chain, encrypt the details for the protocol using NaCl box
          encryption, and set a grace period for resolution. If the protocol
          ignores the disclosure, the hacker can reveal proof publicly after
          the grace period expires.
        </p>
        <p className="text-gray-400 leading-relaxed">
          No intermediaries. No trust assumptions. Cryptographic accountability
          for both sides — on-chain.
        </p>
      </section>

      {/* What We Built */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">What We Built</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <h3 className="text-green-400 font-semibold mb-2">
              On-Chain Disclosure Protocol
            </h3>
            <p className="text-gray-400 text-sm">
              Anchor program with hash commitment, NaCl box encryption, grace
              periods, acknowledgment, resolution, and public reveal stages.
              Full disclosure lifecycle managed trustlessly on Solana.
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <h3 className="text-blue-400 font-semibold mb-2">
              Bounty Escrow System
            </h3>
            <p className="text-gray-400 text-sm">
              Protocols deposit SOL into on-chain vaults with severity-based
              payout rates (Low, Medium, High, Critical). Trustless bounty
              claims on resolution — no middlemen.
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <h3 className="text-purple-400 font-semibold mb-2">
              Protocol Registration
            </h3>
            <p className="text-gray-400 text-sm">
              Programs register with upgrade authority verification via BPF
              Loader programdata. Only the true program owner can register,
              preventing protocol squatting.
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <h3 className="text-yellow-400 font-semibold mb-2">
              Full Web Interface
            </h3>
            <p className="text-gray-400 text-sm">
              Next.js frontend with wallet integration. Submit disclosures,
              register protocols, manage bounty vaults, and track the full
              disclosure lifecycle from a single dashboard.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">How It Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
            <p className="text-2xl mb-2">1</p>
            <h3 className="text-green-400 font-semibold text-sm mb-1">
              Hash &amp; Commit
            </h3>
            <p className="text-gray-500 text-xs">
              SHA-256 hash your exploit proof. Commit on-chain with an
              immutable timestamp.
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
            <p className="text-2xl mb-2">2</p>
            <h3 className="text-blue-400 font-semibold text-sm mb-1">
              Encrypt &amp; Disclose
            </h3>
            <p className="text-gray-500 text-xs">
              NaCl box encrypt your proof for the protocol. Only they can
              decrypt. Set a grace period.
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
            <p className="text-2xl mb-2">3</p>
            <h3 className="text-purple-400 font-semibold text-sm mb-1">
              Acknowledge &amp; Fix
            </h3>
            <p className="text-gray-500 text-xs">
              Protocol verifies, acknowledges, and patches. Resolves the
              disclosure on-chain.
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
            <p className="text-2xl mb-2">4</p>
            <h3 className="text-yellow-400 font-semibold text-sm mb-1">
              Get Paid or Reveal
            </h3>
            <p className="text-gray-500 text-xs">
              Claim bounty from the vault on resolution. Or reveal proof
              publicly if the protocol ghosts you.
            </p>
          </div>
        </div>
      </section>

      {/* Built by Agents */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Built by AI Agents</h2>
        <div className="bg-gray-900 border border-green-900 rounded-lg p-5">
          <p className="text-gray-400 leading-relaxed mb-3">
            This entire project — the Solana program, the frontend, the API
            routes, the security audit, and the bug fixes — was built
            autonomously by AEGIS, a multi-agent orchestration system. The human
            operator provides direction; the agents write the code.
          </p>
          <p className="text-gray-500 text-sm">
            AEGIS uses a hub-and-spoke architecture where a central orchestrator
            coordinates specialized AI agents via isolated MCP channels.
            The orchestrator delegates tasks, reviews output, and iterates — no
            agent talks to another directly.
          </p>
        </div>
      </section>

      {/* Links */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <a
            href={`https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gray-900 border border-gray-800 hover:border-green-600 rounded-lg p-4 transition flex items-center gap-3"
          >
            <span className="text-2xl">&#9939;</span>
            <div>
              <p className="text-green-400 font-semibold">Solana Program</p>
              <p className="text-gray-500 text-xs font-mono">
                {PROGRAM_ID.slice(0, 16)}...{PROGRAM_ID.slice(-4)} (Devnet)
              </p>
            </div>
          </a>
          <a
            href="https://github.com/estentz/proof-of-hack"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-lg p-4 transition flex items-center gap-3"
          >
            <span className="text-2xl">&#128187;</span>
            <div>
              <p className="text-gray-200 font-semibold">GitHub</p>
              <p className="text-gray-500 text-xs">estentz/proof-of-hack</p>
            </div>
          </a>
          <a
            href="https://x.com/ProofofHack"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gray-900 border border-gray-800 hover:border-blue-600 rounded-lg p-4 transition flex items-center gap-3"
          >
            <span className="text-2xl">&#128038;</span>
            <div>
              <p className="text-blue-400 font-semibold">@ProofofHack</p>
              <p className="text-gray-500 text-xs">Follow us on X</p>
            </div>
          </a>
          <a
            href="https://colosseum.com/agent-hackathon"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gray-900 border border-gray-800 hover:border-yellow-600 rounded-lg p-4 transition flex items-center gap-3"
          >
            <span className="text-2xl">&#127942;</span>
            <div>
              <p className="text-yellow-400 font-semibold">
                Agent Hackathon
              </p>
              <p className="text-gray-500 text-xs">
                colosseum.com/agent-hackathon
              </p>
            </div>
          </a>
        </div>
      </section>

      {/* Try It */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Try It Now</h2>
        <p className="text-gray-400 text-sm mb-4">
          The protocol is live on Solana Devnet. Connect a wallet and test it.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/submit"
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition"
          >
            Submit a Disclosure
          </Link>
          <Link
            href="/register"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition"
          >
            Register a Protocol
          </Link>
          <Link
            href="/bounty"
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition"
          >
            View Bounties
          </Link>
          <Link
            href="/dashboard"
            className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition"
          >
            Dashboard
          </Link>
        </div>
      </section>

      {/* Footer */}
      <div className="border-t border-gray-800 pt-6 text-center">
        <p className="text-gray-600 text-xs font-mono">
          Program: {PROGRAM_ID} | Solana Devnet | Anchor 0.32.1
        </p>
      </div>
    </div>
  );
}
