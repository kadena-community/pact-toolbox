import { strict as assert } from "node:assert";
import { type Server } from "node:http";
import { after, before, describe, it } from "node:test";
import type { H3Error } from "h3";

import { getRandomPort } from "@pact-toolbox/utils";

import type { QuicksignSuccessResponseType, SigningResponseType } from "./schemas";
import { startServer, stopServer } from "../../testSetup";
import { setupSigningRoutes } from "./routes";

describe("Kadena Wallet Signing API", async () => {
  const port = await getRandomPort();
  // Define the base URL for the API
  const BASE_URL = `http://localhost:${port}`;

  let server: Server;
  // Start the server before running tests
  before(async () => {
    server = await startServer(port, setupSigningRoutes);
  });

  // Stop the server after tests are done
  after(async () => {
    await stopServer(server);
  });

  describe("POST /v1/sign", () => {
    it("should return a valid SigningResponse for a valid SigningRequest", async () => {
      const validRequest = {
        code: "some_code",
        caps: [
          {
            role: "admin",
            description: "Administrator capabilities",
            cap: {
              name: "foo.bar",
              args: ["arg1", "arg2"],
            },
          },
        ],
        nonce: "unique_nonce",
        chainId: "chain_1",
        gasLimit: 100000,
        ttl: 3600,
        sender: "sender_account",
        extraSigners: ["a".repeat(64), "b".repeat(64)],
      };

      const response = await fetch(`${BASE_URL}/v1/sign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validRequest),
      });

      assert.equal(response.status, 200, "Expected status code 200");

      const responseBody = (await response.json()) as SigningResponseType;

      // Validate response structure
      assert.ok(responseBody.body, "Response should have a body");
      assert.ok(responseBody.chainId, "Response should have a chainId");

      assert.equal(responseBody.body.cmd, validRequest.code, "cmd should match the request code");
      assert.ok(Array.isArray(responseBody.body.sigs), "sigs should be an array");
      assert.equal(responseBody.body.sigs.length, 1, "sigs array should have one signature");
      assert.equal(responseBody.body.sigs[0]?.sig, "mock_signature", "Signature should match mock_signature");
      assert.equal(responseBody.body.hash, "mock_hash", "Hash should match mock_hash");
      assert.equal(responseBody.chainId, "mock_chain_id", "chainId should match mock_chain_id");
    });

    it("should return 400 for an invalid SigningRequest", async () => {
      const invalidRequest = {
        // Missing required fields like 'code' and 'caps'
        nonce: "unique_nonce",
      };

      const response = await fetch(`${BASE_URL}/v1/sign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(invalidRequest),
      });
      const responseBody = (await response.json()) as H3Error;

      assert.equal(response.status, 400, "Expected status code 400");
      assert.equal(responseBody.statusCode, 400, "Expected status code 400");
      assert.equal(
        responseBody.statusMessage,
        "Invalid request body",
        "Error message should indicate invalid request body",
      );
    });
  });

  describe("POST /v1/quickSign", () => {
    it("should return a valid QuicksignSuccess response for a valid QuicksignRequest", async () => {
      const validQuicksignRequest = {
        cmdSigDatas: [
          {
            cmd: "mock_cmd",
            sigs: [
              {
                pubKey: "a".repeat(64),
                sig: "mock_sig",
              },
            ],
          },
        ],
      };

      const response = await fetch(`${BASE_URL}/v1/quickSign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validQuicksignRequest),
      });

      assert.equal(response.status, 200, "Expected status code 200");

      const responseBody = (await response.json()) as QuicksignSuccessResponseType;

      // Validate response structure
      assert.ok(Array.isArray(responseBody.responses), "responses should be an array");
      assert.equal(responseBody.responses.length, 1, "responses array should have one item");

      const responseItem = responseBody.responses[0]!;
      assert.ok(responseItem.commandSigData, "Response item should have commandSigData");
      assert.ok(responseItem.outcome, "Response item should have outcome");

      assert.equal(responseItem.commandSigData.cmd, "mock_cmd", "cmd should match mock_cmd");
      assert.ok(Array.isArray(responseItem.commandSigData.sigs), "sigs should be an array");
      assert.equal(responseItem.commandSigData.sigs.length, 1, "sigs array should have one signature");
      assert.equal(responseItem.commandSigData.sigs[0]?.pubKey, "a".repeat(64), "pubKey should match");
      assert.equal(responseItem.commandSigData.sigs[0].sig, "mock_sig", "sig should match mock_sig");

      assert.equal(responseItem.outcome.result, "success", "outcome result should be success");
      assert.equal(responseItem.outcome.hash, "mock_hash", "outcome hash should match mock_hash");
    });

    it("should return 400 for an invalid QuicksignRequest", async () => {
      const invalidQuicksignRequest = {
        // Missing required fields like 'cmdSigDatas'
      };

      const response = await fetch(`${BASE_URL}/v1/quickSign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(invalidQuicksignRequest),
      });

      const responseBody = (await response.json()) as H3Error;

      assert.equal(response.status, 400, "Expected status code 400");
      assert.equal(responseBody.statusCode, 400, "Expected status code 400");
      assert.equal(
        responseBody.statusMessage,
        "Invalid request body",
        "Error message should indicate invalid request body",
      );
    });
  });
});
