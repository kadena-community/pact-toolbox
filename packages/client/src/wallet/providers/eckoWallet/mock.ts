import type { ToolboxNetworkContext } from "../../../network";
import type {
  KdaCheckStatusRequest,
  KdaConnectRequest,
  KdaDisconnectRequest,
  KdaRequestAccountRequest,
  KdaRequestSignRequest,
  WalletApi,
  WalletRequest,
} from "./types";
import { createToolboxNetworkContext } from "../../../network";
import { signingRequestToPactTransaction } from "../../utils";

async function handleKdaConnect(request: KdaConnectRequest, context: ToolboxNetworkContext) {
  const account = await context.getWallet().connect(request.networkId);
  return {
    status: "success",
    account,
  };
}

async function handleKdaRequestAccount(request: KdaRequestAccountRequest, context: ToolboxNetworkContext) {
  const wallet = await context.getWallet().getAccountDetails(request.networkId);
  return {
    status: "success",
    wallet,
  };
}

async function handleKdaCheckStatus(request: KdaCheckStatusRequest, context: ToolboxNetworkContext) {
  const isConnected = await context.getWallet().isConnected(request.networkId);
  const wallet = isConnected ? await context.getWallet().getAccountDetails(request.networkId) : undefined;
  return {
    status: isConnected ? "success" : "fail",
    message: isConnected ? "connected" : "disconnected",
    wallet,
  };
}

async function handleKdaDisconnect(request: KdaDisconnectRequest, context: ToolboxNetworkContext) {
  await context.getWallet().disconnect(request.networkId);
  return {
    status: "success",
    message: "disconnected",
  };
}

async function handleKdaSign(request: KdaRequestSignRequest, context: ToolboxNetworkContext) {
  const signedCmd = await signingRequestToPactTransaction(
    request,
    await context.getWallet().getSigner(request.data.signingCmd.sender),
  )
    .withContext(context)
    .sign()
    .getSignedTransaction();
  return {
    status: "success",
    signedCmd,
  };
}

// async function handleKdaQuickSign(request: WalletRequest) {
//   const signature = await toolboxWallet.quickSign(request.networkId, request.payload);
//   return {
//     status: 'success',
//     signature,
//   };
// }

async function handleWalletRequest(request: WalletRequest, context: ToolboxNetworkContext) {
  switch (request.method) {
    case "kda_connect": 
      return handleKdaConnect(request, context);
    
    case "kda_requestAccount": 
      return handleKdaRequestAccount(request, context);
    
    case "kda_checkStatus": 
      return handleKdaCheckStatus(request, context);
    
    case "kda_disconnect": 
      return handleKdaDisconnect(request, context);
    
    case "kda_getNetwork": 
      return context.getWallet().getNetwork();
    
    case "kda_requestSign": 
      return handleKdaSign(request, context);
    
    default: 
      throw new Error("Invalid method");
    
  }
}
export function createEckoWalletMock(context?: ToolboxNetworkContext): WalletApi {
  if (!context) {
    context = createToolboxNetworkContext();
  }
  const request = (request: WalletRequest) => handleWalletRequest(request, context);
  return {
    isKadena: true,
    on: (event: string, callback: any) => {},
    // @ts-expect-error
    request: handleWalletRequest,
  };
}

export function mockEckoWallet(): void {
  //@ts-expect-error
  globalThis.kadena = createEckoWalletMock();
}
