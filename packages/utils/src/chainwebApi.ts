import { logger } from "./logger";

/**
 * Custom error class for Chainweb-related errors.
 */
export class ChainWebError extends Error {
  constructor(
    message: string,
    public cause?: Error | undefined,
  ) {
    super(message);
    this.name = "ChainWebError";
    if (cause) {
      this.stack += "\nCaused by: " + cause.stack;
    }
  }
}

/**
 * Checks if the Chainweb node is healthy.
 * @param serviceUrl - The base URL of the Chainweb service.
 * @param timeout - Optional timeout in milliseconds.
 * @returns Promise<boolean> - True if the node is healthy, false otherwise.
 */
export async function isChainWebNodeOk(serviceUrl: string, timeout = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    const res = await fetch(`${serviceUrl}/health-check`, {
      signal: controller.signal,
    });

    clearTimeout(id);

    if (!res.ok) {
      return false;
    }

    const message = await res.text();
    if (message.includes("Health check OK.")) {
      return true;
    } else {
      return false;
    }
  } catch (e) {
    return false;
  }
}

/**
 * Checks if the Chainweb node has reached the target block height.
 * @param targetHeight - The target block height.
 * @param serviceUrl - The base URL of the Chainweb service.
 * @param timeout - Optional timeout in milliseconds.
 * @returns Promise<boolean> - True if the node is at or above the target height, false otherwise.
 */
export async function isChainWebAtHeight(targetHeight: number, serviceUrl: string, timeout = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    const res = await fetch(`${serviceUrl}/chainweb/0.0/development/cut`, {
      signal: controller.signal,
    });

    clearTimeout(id);

    if (!res.ok) {
      logger.error(`Failed to get chainweb cut: ${res.status} ${res.statusText}`);
      return false;
    }

    const data = (await res.json()) as { height: number };

    if (typeof data.height !== "number") {
      logger.error(`Invalid response: height is not a number`);
      return false;
    }

    const height = data.height;
    return height >= targetHeight;
  } catch (e: any) {
    if (e.name === "AbortError") {
      logger.error("Chainweb cut request timed out");
    } else {
      logger.error(`Failed to get chainweb cut: ${e.message}`);
    }
    return false;
  }
}

export interface MakeBlocksParams {
  count?: number;
  chainIds?: string[];
  onDemandUrl: string;
}

/**
 * Requests the Chainweb node to create blocks on specified chains.
 * @param params - Parameters including count, chainIds, and onDemandUrl.
 * @returns Promise<any> - The response data from the server.
 */
export async function makeBlocks({ count = 1, chainIds = ["0"], onDemandUrl }: MakeBlocksParams): Promise<any> {
  const body = JSON.stringify(
    chainIds.reduce((acc, chainId) => ({ ...acc, [chainId]: count }), {} as Record<string, number>),
  );

  const res = await fetch(`${onDemandUrl}/make-blocks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!res.ok) {
    throw new Error(`Failed to make blocks ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Checks if blocks were successfully created.
 * @param params - Parameters including count, chainIds, and onDemandUrl.
 * @returns Promise<boolean> - True if blocks were made successfully, false otherwise.
 */
export async function didMakeBlocks(params: MakeBlocksParams): Promise<boolean> {
  try {
    await makeBlocks(params);
    return true;
  } catch (e) {
    return false;
  }
}
