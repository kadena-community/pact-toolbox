import type { ChainId } from "@kadena/client";
import type { PactCmdPayload, PactEnvData, PactSigner } from "@pact-toolbox/types";

import type { KdaRequestSignRequest } from "./providers/eckoWallet/types";
import type { WalletSigner } from "./wallet";
import { PactTransactionBuilder } from "../builder";

export function signingRequestToPactTransaction(
  request: KdaRequestSignRequest,
  signer: WalletSigner,
): PactTransactionBuilder<any> {
  const signingCmd = request.data.signingCmd;
  const execPayload: PactCmdPayload = {
    exec: {
      code: signingCmd.code,
      data: (signingCmd.data ?? {}) as PactEnvData,
    },
  };

  const signers = signingCmd.caps.map((cap) => ({
    pubKey: signer.publicKey,
    clist: [cap],
  })) as PactSigner[];

  const tx = new PactTransactionBuilder(execPayload)
    .withNetworkId(request.data.networkId)
    .withMeta({
      chainId: signingCmd.chainId as ChainId,
      sender: signingCmd.sender,
      gasLimit: signingCmd.gasLimit,
      gasPrice: signingCmd.gasPrice,
      ttl: signingCmd.ttl,
      creationTime: Math.floor(Date.now() / 1000),
    })
    .withSigner(signers)
    .withNonce(signingCmd.nonce ?? "");

  return tx;
}
