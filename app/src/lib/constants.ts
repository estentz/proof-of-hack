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
