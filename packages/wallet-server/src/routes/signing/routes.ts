import type { Router } from "h3";
import { createError, defineEventHandler, readValidatedBody, sendError } from "h3";

import type {
  QuicksignRequestType,
  QuicksignResponseType,
  QuicksignSuccessItemType,
  SigningRequestType,
  SigningResponseType,
} from "./schemas";
import {
  QuicksignRequestSchema,
  QuicksignResponseSchema,
  SigningRequestSchema,
  SigningResponseSchema,
} from "./schemas";

// Placeholder functions for processing signing and quick signing
const processSignRequest = async (request: SigningRequestType): Promise<SigningResponseType> => {
  // TODO: Implement the actual signing logic
  // For demonstration, return a mock response
  return {
    body: {
      cmd: request.code,
      sigs: [{ sig: "mock_signature" }],
      hash: "mock_hash",
    },
    chainId: "mock_chain_id",
  };
};

const processQuickSignRequest = async (request: QuicksignRequestType): Promise<QuicksignResponseType> => {
  // TODO: Implement the actual quick signing logic
  // For demonstration, return a mock success response
  const successItem = {
    commandSigData: {
      cmd: "mock_cmd",
      sigs: [
        {
          pubKey: "a".repeat(64),
          sig: "mock_sig",
        },
      ],
    },
    outcome: {
      result: "success",
      hash: "mock_hash",
    },
  } satisfies QuicksignSuccessItemType;

  return {
    responses: [successItem],
  };
};

// Handler for /v1/sign
export const signHandler = defineEventHandler(async (event) => {
  try {
    const body = await readValidatedBody(event, (body) => SigningRequestSchema.safeParse(body));
    if (!body.success) {
      // Validation failed
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid request body",
        data: body.error.errors,
      });
    }

    const signingResponse = await processSignRequest(body.data);

    // Validate response structure
    const responseValidation = SigningResponseSchema.safeParse(signingResponse);
    if (!responseValidation.success) {
      throw createError({
        statusCode: 500,
        statusMessage: "Internal Server Error: Invalid response structure",
      });
    }

    return responseValidation.data;
  } catch (error) {
    // Handle and propagate errors
    sendError(event, error as any);
  }
});

// Handler for /v1/quicksign
export const quickSignHandler = defineEventHandler(async (event) => {
  try {
    const body = await readValidatedBody(event, (body) => QuicksignRequestSchema.safeParse(body));

    if (!body.success) {
      // Validation failed
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid request body",
        data: body.error.errors,
      });
    }

    const quickSignResponse = await processQuickSignRequest(body.data);

    // Validate response structure
    const responseValidation = QuicksignResponseSchema.safeParse(quickSignResponse);
    if (!responseValidation.success) {
      throw createError({
        statusCode: 500,
        statusMessage: "Internal Server Error: Invalid response structure",
      });
    }

    return responseValidation.data;
  } catch (error) {
    // Handle and propagate errors
    sendError(event, error as any);
  }
});

const connectHandler = defineEventHandler(async (event) => {
  try {
    return { status: 200, body: "Connected" };
  } catch (error) {
    // Handle and propagate errors
    sendError(event, error as any);
  }
});

export function setupSigningRoutes(router: Router): void {
  router.post("/v1/sign", signHandler);
  router.post("/v1/quickSign", quickSignHandler);
  router.post("/v1/connect", connectHandler);
}
