// types.ts
import { z } from "zod";

// Basic Schemas
const ChainId = z.string();
const Hash = z.string().regex(/^[A-Za-z0-9-_]+$/, "Invalid base64url format");
const GasLimit = z.number().min(0);
const TTLSeconds = z.number();
const AccountName = z.string();
const PublicKey = z
  .string()
  .length(64)
  .regex(/^[0-9a-fA-F]{64}$/, "Invalid public key format");

// Capability Schemas
const Capability = z.object({
  name: z
    .string()
    .min(1)
    .regex(
      /^([a-zA-Z%#+\-_&$@<>=^?*!|\/~][a-zA-Z0-9%#+\-_&$@<>=^?*!|\/~]*)(\.[a-zA-Z%#+\-_&$@<>=^?*!|\/~][a-zA-Z0-9%#+\-_&$@<>=^?*!|\/~]*){1,2}$/,
    ),
  args: z.array(z.string()),
});

const CapabilityWithDescription = z.object({
  role: z.string(),
  description: z.string(),
  cap: Capability,
});

// Command and Signing Schemas
const QuicksignSignature = z.object({
  sig: z.string(),
});

const Command = z.object({
  cmd: z.string(),
  sigs: z.array(QuicksignSignature),
  hash: Hash,
});

// Quicksign Schemas
const CommandSigDataSignature = z.object({
  pubKey: PublicKey,
  sig: z.string().nullable(),
});

const CommandSigData = z.object({
  sigs: z.array(CommandSigDataSignature),
  cmd: z.string(),
});

// Signing Outcome Schemas
const SigningOutcome_Success = z.object({
  result: z.literal("success"),
  hash: z.string(),
});

const SigningOutcome_Failure = z.object({
  result: z.literal("failure"),
  msg: z.string(),
});

const SigningOutcome_NoSig = z.object({
  result: z.literal("noSig"),
});

const SigningOutcome = z.discriminatedUnion("result", [
  SigningOutcome_Success,
  SigningOutcome_Failure,
  SigningOutcome_NoSig,
]);

// Quicksign Response Schemas
export const QuicksignSuccessItem = z.object({
  commandSigData: CommandSigData,
  outcome: SigningOutcome,
});

const QuicksignSuccessResponse = z.object({
  responses: z.array(QuicksignSuccessItem),
});

const QuicksignErrorReject = z.object({
  type: z.literal("reject"),
});

const QuicksignErrorEmptyList = z.object({
  type: z.literal("emptyList"),
});

const QuicksignErrorOther = z.object({
  type: z.literal("other"),
  msg: z.string(),
});

const QuicksignError = z.discriminatedUnion("type", [
  QuicksignErrorReject,
  QuicksignErrorEmptyList,
  QuicksignErrorOther,
]);

const QuicksignErrorResponse = z.object({
  error: QuicksignError,
});

// Signing Request
export const SigningRequestSchema = z.object({
  code: z.string(),
  caps: z.array(CapabilityWithDescription),
  data: z.record(z.any()).optional(),
  nonce: z.string().optional(),
  chainId: ChainId.optional(),
  gasLimit: GasLimit.optional(),
  ttl: TTLSeconds.optional(),
  sender: AccountName.optional(),
  extraSigners: z.array(PublicKey).optional(),
});

export const SigningResponseSchema = z.object({
  body: Command,
  chainId: ChainId,
});

export const QuicksignRequestSchema = z.object({
  cmdSigDatas: z.array(CommandSigData),
});

export const QuicksignResponseSchema = z.union([QuicksignSuccessResponse, QuicksignErrorResponse]);

// Export TypeScript Types
export type SigningRequestType = z.infer<typeof SigningRequestSchema>;
export type SigningResponseType = z.infer<typeof SigningResponseSchema>;
export type QuicksignRequestType = z.infer<typeof QuicksignRequestSchema>;
export type QuicksignResponseType = z.infer<typeof QuicksignResponseSchema>;
export type QuicksignSuccessResponseType = z.infer<typeof QuicksignSuccessResponse>;
export type QuicksignErrorResponseType = z.infer<typeof QuicksignErrorResponse>;
export type QuicksignSuccessItemType = z.infer<typeof QuicksignSuccessItem>;
