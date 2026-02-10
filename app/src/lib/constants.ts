import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  "4uYHTyZzVZjzJh4Dvh8R1hE779SxPbZj7ZMTTHAWTQAn"
);

export const NETWORK = "devnet";
export const RPC_ENDPOINT = "https://api.devnet.solana.com";

export const SEVERITY_LABELS: Record<number, string> = {
  1: "Low",
  2: "Medium",
  3: "High",
  4: "Critical",
};

export const STATUS_LABELS: Record<number, string> = {
  0: "Submitted",
  1: "Acknowledged",
  2: "Resolved",
  3: "Revealed",
};

export const STATUS_COLORS: Record<number, string> = {
  0: "bg-yellow-500",
  1: "bg-blue-500",
  2: "bg-green-500",
  3: "bg-red-500",
};

export const SEVERITY_COLORS: Record<number, string> = {
  1: "bg-gray-500",
  2: "bg-yellow-500",
  3: "bg-orange-500",
  4: "bg-red-600",
};

// Anchor error codes start at 6000. Map error code number to human-readable message.
export const ERROR_MESSAGES: Record<number, string> = {
  6000: "Protocol name must be between 1 and 64 characters.",
  6001: "Severity must be between 1 (Low) and 4 (Critical).",
  6002: "Grace period must be at least 60 seconds.",
  6003: "Encrypted proof exceeds the maximum size of 1024 bytes. Shorten your proof or use off-chain storage.",
  6004: "This disclosure is not in the expected status for this action.",
  6005: "The grace period hasn't ended yet. You can reveal after the countdown reaches zero.",
  6006: "The proof text doesn't match your original submission. Use the exact text you submitted.",
  6007: "Only the protocol authority can perform this action.",
  6008: "Only the original hacker can perform this action.",
  6009: "Protocol does not match the disclosure's target program.",
  6010: "This disclosure has already been claimed by a protocol.",
  6011: "Plaintext proof exceeds the maximum size of 1024 bytes.",
  6012: "Grace period exceeds the maximum allowed (1 year).",
  6013: "Grace period calculation overflow.",
  6014: "The bounty vault is not active.",
  6015: "The bounty vault doesn't have enough SOL to cover this payout.",
  6016: "This bounty has already been claimed.",
  6017: "The disclosure must be resolved before you can claim the bounty.",
  6018: "Arithmetic overflow in bounty calculation.",
  6019: "Only the protocol authority can manage the bounty vault.",
  6020: "The grace period is shorter than this protocol's minimum requirement.",
  6021: "Minimum grace period must be between 0 and 1 year.",
  6022: "You must connect the wallet that holds the upgrade authority for this program.",
  6023: "Target program data account is invalid.",
  6024: "Protocol config PDA must be provided when targeting a registered protocol.",
  6025: "Invalid protocol config PDA.",
  6026: "Bounty vault is already inactive.",
  6027: "New authority cannot be the zero address.",
};

export function parseAnchorError(err: any): string {
  const msg = err?.message || err?.toString() || "Unknown error";

  // Try to extract Anchor error code from the message
  const codeMatch = msg.match(/Error Code:\s*\w+\.\s*Error Number:\s*(\d+)/);
  if (codeMatch) {
    const code = parseInt(codeMatch[1]);
    if (ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  }

  // Try hex error code pattern (e.g., 0x1772)
  const hexMatch = msg.match(/0x([0-9a-fA-F]+)/);
  if (hexMatch) {
    const code = parseInt(hexMatch[1], 16);
    if (ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  }

  // Try "custom program error: XXXX" pattern
  const customMatch = msg.match(/custom program error:\s*(\d+)/i);
  if (customMatch) {
    const code = parseInt(customMatch[1]);
    if (ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  }

  // Common non-Anchor errors
  if (msg.includes("already in use")) return "This account already exists. The bounty may have already been claimed.";
  if (msg.includes("insufficient funds") || msg.includes("Insufficient")) return "Insufficient SOL balance. Fund your wallet and try again.";
  if (msg.includes("User rejected")) return "Transaction was rejected in your wallet.";
  if (msg.includes("Blockhash not found")) return "Transaction expired. Please try again.";

  return msg;
}
