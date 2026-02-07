import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  "4uYHTyZzVZjzJh4Dvh8R1hE779SxPbZj7ZMTTHAWTQAn"
);

export const SEVERITY = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
} as const;

export const DISCLOSURE_STATUS = {
  SUBMITTED: 0,
  ACKNOWLEDGED: 1,
  RESOLVED: 2,
  REVEALED: 3,
} as const;

export const MIN_GRACE_PERIOD = 60; // seconds
export const DEFAULT_GRACE_PERIOD = 604800; // 7 days in seconds
export const MAX_ENCRYPTED_PROOF = 1024; // bytes
export const MAX_PROTOCOL_NAME = 64; // chars
