import type { Wallet, WalletMetadata, WalletProvider } from "@pact-toolbox/wallet-core";
import { WalletConnectWallet } from "./wallet";
import type { WalletConnectOptions } from "./types";

/**
 * Provider for WalletConnect
 */
export class WalletConnectProvider implements WalletProvider {
  private options: WalletConnectOptions;

  constructor(options: WalletConnectOptions) {
    this.options = options;
  }

  readonly metadata: WalletMetadata = {
    id: "walletconnect",
    name: "WalletConnect",
    description: "Connect to mobile wallets via WalletConnect protocol",
    type: "mobile",
    icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjE4NSIgdmlld0JveD0iMCAwIDMwMCAxODUiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik02MS40Mzc4IDM2LjI1NjJDOTYuMjg3NCAwLjMxMjUgMTUzLjcxMyAwLjMxMjUgMTg4LjU2MiAzNi4yNTYyTDI5My4yNzggMTQ1LjMxMUMyOTUuNDI3IDE0Ny40OTMgMjk1LjQyNyAxNTEuMDIzIDI5My4yNzggMTUzLjIwNkwyNzEuODIyIDE3NS4yODNDMjcwLjc0OCAxNzYuMzczIDI2OS4wNzQgMTc2LjM3MyAyNjcuOTk5IDE3NS4yODNMMTcyLjU2NyA3Ni4wNjhDMTU1LjM3NCA1OC4yNjc2IDEyNy42MjYgNTguMjY3NiAxMTAuNDMzIDc2LjA2OEwxNS4wMDEgMTc1LjI4M0MxMy45MjY2IDE3Ni4zNzMgMTIuMjUyNSAxNzYuMzczIDExLjE3ODEgMTc1LjI4M0w1LjcyMjE5IDE2OS42MTVDNC42NDc4NCAxNjguNTI1IDQuNjQ3ODQgMTY0Ljk5NSA1LjcyMjE5IDE2My45MDVMMTEwLjQzOCA1NC44NTAyQzEyNy42MzEgMzcuMDUwMyAxNTUuMzc5IDM3LjA1MDMgMTcyLjU3MiA1NC44NTAyTDI3Ny4yODggMTYzLjkwNUMyNzguMzYzIDE2NC45OTUgMjc4LjM2MyAxNjguNTI1IDI3Ny4yODggMTY5LjYxNUwyNTUuODMyIDE5MS42OTJDMjU0Ljc1OCAxOTIuNzgyIDI1My4wODQgMTkyLjc4MiAyNTIuMDA5IDE5MS42OTJMMTU2LjU3NyA5Mi40NzdDMTQ5LjQ4MSA4NS4xMzY3IDEzOC41MTkgODUuMTM2NyAxMzEuNDIzIDkyLjQ3N0wzNi4wNDU0IDE5MS42OTJDMzQuOTcxIDE5Mi43ODIgMzMuMjk3MSAxOTIuNzgyIDMyLjIyMjcgMTkxLjY5MkwxMC43NjY3IDE2OS42MTVDOS42OTIzNSAxNjguNTI1IDkuNjkyMzUgMTY0Ljk5NSAxMC43NjY3IDE2My45MDVMMTUuNDg4OCAxNTguOTYzQzE2LjU2MzIgMTU3Ljg3MyAxOC4yMzcxIDE1Ny44NzMgMTkuMzExNSAxNTguOTYzTDExOS40NjMgMjYyLjM4N0MxMzIuNzU3IDI3Ni4wNDUgMTUzLjI0MyAyNzYuMDQ1IDE2Ni41MzcgMjYyLjM4N0wyNjYuNjg5IDE1OC45NjNDMjY3Ljc2MyAxNTcuODczIDI2OS40MzcgMTU3Ljg3MyAyNzAuNTEyIDE1OC45NjNMMjc1LjIzNCAxNjMuOTA1QzI3Ni4zMDggMTY0Ljk5NSAyNzYuMzA4IDE2OC41MjUgMjc1LjIzNCAxNjkuNjE1TDE2Ni41MzcgMjgxLjA4OEMxNTMuMjQzIDI5NC43NDYgMTMyLjc1NyAyOTQuNzQ2IDExOS40NjMgMjgxLjA4OEwxMC43NjY3IDE2OS42MTVDNS4yNjIzNSAxNjMuOTQ1IDUuMjYyMzUgMTU1LjI3MSAxMC43NjY3IDE0OS42MDFMMTIzLjY4NSAzMi40MzU5QzEzNi45NzkgMTguNzc3OCAxNTcuNDY1IDE4Ljc3NzggMTcwLjc1OSAzMi40MzU5TDI4My42NzggMTQ5LjYwMUMyODkuMTgyIDE1NS4yNzEgMjg5LjE4MiAxNjMuOTQ1IDI4My42NzggMTY5LjYxNUwyNzAuNzU5IDI4MS4wODhDMjU3LjQ2NSAyOTQuNzQ2IDIzNi45NzkgMjk0Ljc0NiAyMjMuNjg1IDI4MS4wODhMMTEwLjc2NiAxNjMuOTA1QzEwNS4yNjIgMTU4LjIzNSAxMDUuMjYyIDE0OS41NjEgMTEwLjc2NiAxNDMuODkxTDIyMy42ODUgMjYuNzI1OUMyMzYuOTc5IDEzLjA2NzggMjU3LjQ2NSAxMy4wNjc4IDI3MC43NTkgMjYuNzI1OUwyODMuNjc4IDEzNy45OTJDODI4OS4xODIgMTU1LjY0NSAyODkuMTgyIDE3Mi4yODkgMjgzLjY3OCAxNzguOTU5TDI3MC43NTkgMjkxLjEyNkMyNTcuNDY1IDMwNC43ODQgMjM2Ljk3OSAzMDQuNzg0IDIyMy42ODUgMjkxLjEyNkwxMTAuNzY2IDE3My45NTlDMTA1LjI2MiAxNjguMjg5IDEwNS4yNjIgMTU5LjYxNSAxMTAuNzY2IDE1My45NDVMMjIzLjY4NSAzNi43Nzk3QzIzNi45NzkgMjMuMTIxNiAyNTcuNDY1IDIzLjEyMTYgMjcwLjc1OSAzNi43Nzk3TDI4My42NzggMTQ4LjA0NkMyODkuMTgyIDE1My43MTYgMjg5LjE4MiAxNjIuMzkgMjgzLjY3OCAxNjguMDZMMjcwLjc1OSAyNzkuMTg3QzI1Ny40NjUgMjkyLjg0NSAyMzYuOTc5IDI5Mi44NDUgMjIzLjY4NSAyNzkuMTg3TDExMC43NjYgMTYyLjAyQzEwNS4yNjIgMTU2LjM1IDEwNS4yNjIgMTQ3LjY3NiAxMTAuNzY2IDE0Mi4wMDZMMjIzLjY4NSAyNC44Mzk4QzIzNi45NzkgMTEuMTgxNyAyNTcuNDY1IDExLjE4MTcgMjcwLjc1OSAyNC44Mzk4TDI4My42NzggMTM2LjEwNkMyODkuMTgyIDE0MS43NzYgMjg5LjE4MiAxNTAuNDUgMjgzLjY3OCAxNTYuMTJMMjcwLjc1OSAyNjcuMjQ3QzI1Ny40NjUgMjgwLjkwNSAyMzYuOTc5IDI4MC45MDUgMjIzLjY4NSAyNjcuMjQ3TDExMC43NjYgMTUwLjA4QzEwNS4yNjIgMTQ0LjQxIDEwNS4yNjIgMTM1LjczNiAxMTAuNzY2IDEzMC4wNjZMMjIzLjY4NSAxMi44OTk4QzIzNi45NzkgLTAuNzU4MjAzIDI1Ny40NjUgLTAuNzU4MjAzIDI3MC43NTkgMTIuODk5OEwyODMuNjc4IDEyNC4xNjZDMjg5LjE4MiAxMjkuODM2IDI4OS4xODIgMTM4LjUxIDI4My42NzggMTQ0LjE4TDI3MC43NTkgMjU1LjMwN0MyNTcuNDY1IDI2OC45NjUgMjM2Ljk3OSAyNjguOTY1IDIyMy42ODUgMjU1LjMwN0wxMTAuNzY2IDEzOC4xNEMxMDUuMjYyIDEzMi40NyAxMDUuMjYyIDEyMy43OTYgMTEwLjc2NiAxMTguMTI2TDIyMy42ODUgMC45NTk2MjJDMjM2Ljk3OSAtMTIuNjk4MyAyNTcuNDY1IC0xMi42OTgzIDI3MC43NTkgMC45NTk2MjJMMjgzLjY3OCAxMTIuMjI2QzI4OS4xODIgMTE3Ljg5NiAyODkuMTgyIDEyNi41NyAyODMuNjc4IDEzMi4yNEwyNzAuNzU5IDI0My4zNjdDMjU3LjQ2NSAyNTcuMDI1IDIzNi45NzkgMjU3LjAyNSAyMjMuNjg1IDI0My4zNjdMMTEwLjc2NiAxMjYuMkMxMDUuMjYyIDEyMC41MyAxMDUuMjYyIDExMS44NTYgMTEwLjc2NiAxMDYuMTg2TDIyMy42ODUgLTEwLjk4MDRDMjM2Ljk3OSAtMjQuNjM4NSAyNTcuNDY1IC0yNC42Mzg1IDI3MC43NTkgLTEwLjk4MDRMMjgzLjY3OCAxMDAuMjg2QzI4OS4xODIgMTA1Ljk1NiAyODkuMTgyIDExNC42MyAyODMuNjc4IDEyMC4zTDI3MC43NTkgMjMxLjQyN0MyNTcuNDY1IDI0NS4wODUgMjM2Ljk3OSAyNDUuMDg1IDIyMy42ODUgMjMxLjQyN0wxMTAuNzY2IDExNC4yNkMxMDUuMjYyIDEwOC41OSAxMDUuMjYyIDk5LjkxNjIgMTEwLjc2NiA5NC4yNDYyTDIyMy42ODUgLTIyLjkyMDRDMjM2Ljk3OSAtMzYuNTc4NSAyNTcuNDY1IC0zNi41Nzg1IDI3MC43NTkgLTIyLjkyMDRMMjgzLjY3OCA4OC4zNDU3QzI4OS4xODIgOTQuMDE1NyAyODkuMTgyIDEwMi42OTAgMjgzLjY3OCAxMDguMzZMMjcwLjc1OSAyMTkuNDg3QzI1Ny40NjUgMjMzLjE0NSAyMzYuOTc5IDIzMy4xNDUgMjIzLjY4NSAyMTkuNDg3TDExMC43NjYgMTAyLjMyQzEwNS4yNjIgOTYuNjUwMiAxMDUuMjYyIDg3Ljk3NjMgMTEwLjc2NiA4Mi4zMDYyTDIyMy42ODUgLTM0Ljg2MDRDMjM2Ljk3OSAtNDguNTE4NSAyNTcuNDY1IC00OC41MTg1IDI3MC43NTkgLTM0Ljg2MDRMMjgzLjY3OCA3Ni40MDU3QzI4OS4xODIgODIuMDc1NyAyODkuMTgyIDkwLjc0OTYgMjgzLjY3OCA5Ni40MTk2TDI3MC43NTkgMjA3LjU0N0MyNTcuNDY1IDIyMS4yMDUgMjM2Ljk3OSAyMjEuMjA1IDIyMy42ODUgMjA3LjU0N0wxMTAuNzY2IDkwLjM4MDJDMTA1LjI2MiA4NC43MTAyIDEwNS4yNjIgNzYuMDM2MyAxMTAuNzY2IDcwLjM2NjJMMjIzLjY4NSAtNDYuODAwNEMyMzYuOTc5IC02MC40NTg1IDI1Ny40NjUgLTYwLjQ1ODUgMjcwLjc1OSAtNDYuODAwNEwyODMuNjc4IDY0LjQ2NTdDMjg5LjE4MiA3MC4xMzU3IDI4OS4xODIgNzguODA5NiAyODMuNjc4IDg0LjQ3OTZMMjcwLjc1OSAxOTUuNjA3QzI1Ny40NjUgMjA5LjI2NSAyMzYuOTc5IDIwOS4yNjUgMjIzLjY4NSAxOTUuNjA3TDExMC43NjYgNzguNDQwMkMxMDUuMjYyIDcyLjc3MDIgMTA1LjI2MiA2NC4wOTYzIDExMC43NjYgNTguNDI2MkwyMjMuNjg1IC01OC43NDA0QzIzNi45NzkgLTcyLjM5ODUgMjU3LjQ2NSAtNzIuMzk4NSAyNzAuNzU5IC01OC43NDA0TDI4My42NzggNTIuNTI1N0MyODkuMTgyIDU4LjE5NTcgMjg5LjE4MiA2Ni44Njk2IDI4My42NzggNzIuNTM5NkwyNzAuNzU5IDE4My42NjdDMjU3LjQ2NSAxOTcuMzI1IDIzNi45NzkgMTk3LjMyNSAyMjMuNjg1IDE4My42NjdMMTEwLjc2NiA2Ni41MDAyQzEwNS4yNjIgNjAuODMwMiAxMDUuMjYyIDUyLjE1NjMgMTEwLjc2NiA0Ni40ODYyTDIyMy42ODUgLTcwLjY4MDRDMjM2Ljk3OSAtODQuMzM4NSAyNTcuNDY1IC04NC4zMzg1IDI3MC43NTkgLTcwLjY4MDRMMjgzLjY3OCA0MC41ODU3QzI4OS4xODIgNDYuMjU1NyAyODkuMTgyIDU0LjkyOTYgMjgzLjY3OCA2MC41OTk2TDI3MC43NTkgMTcxLjcyN0MyNTcuNDY1IDE4NS4zODUgMjM2Ljk3OSAxODUuMzg1IDIyMy42ODUgMTcxLjcyN0wxMTAuNzY2IDU0LjU2MDJDMTA1LjI2MiA0OC44OTAyIDEwNS4yNjIgNDAuMjE2MyAxMTAuNzY2IDM0LjU0NjJMMjIzLjY4NSAtODIuNjIwNEMyMzYuOTc5IC05Ni4yNzg1IDI1Ny40NjUgLTk2LjI3ODUgMjcwLjc1OSAtODIuNjIwNEwyODMuNjc4IDI4LjY0NTdDMjg5LjE4MiAzNC4zMTU3IDI4OS4xODIgNDIuOTg5NiAyODMuNjc4IDQ4LjY1OTZMMjcwLjc1OSAxNTkuNzg3QzI1Ny40NjUgMTczLjQ0NSAyMzYuOTc5IDE3My40NDUgMjIzLjY4NSAxNTkuNzg3TDExMC43NjYgNDIuNjIwMkMxMDUuMjYyIDM2Ljk1MDIgMTA1LjI2MiAyOC4yNzYzIDExMC43NjYgMjIuNjA2MkwyMjMuNjg1IC05NC41NjA0QzIzNi45NzkgLTEwOC4yMTggMjU3LjQ2NSAtMTA4LjIxOCAyNzAuNzU5IC05NC41NjA0TDI4My42NzggMTYuNzA1N0MyODkuMTgyIDIyLjM3NTcgMjg5LjE4MiAzMS4wNDk2IDI4My42NzggMzYuNzE5NkwyNzAuNzU5IDE0Ny44NDdDMjU3LjQ2NSAxNjEuNTA1IDIzNi45NzkgMTYxLjUwNSAyMjMuNjg1IDE0Ny44NDdMMTEwLjc2NiAzMC42ODAyQzEwNS4yNjIgMjUuMDEwMiAxMDUuMjYyIDE2LjMzNjMgMTEwLjc2NiAxMC42NjYyTDIyMy42ODUgLTEwNi41MDA0QzIzNi45NzkgLTEyMC4xNTggMjU3LjQ2NSAtMTIwLjE1OCAyNzAuNzU5IC0xMDYuNTAwNEwyODMuNjc4IDQuNzY1N0MyODkuMTgyIDEwLjQzNTcgMjg5LjE4MiAxOS4xMDk2IDI4My42NzggMjQuNzc5NkwyNzAuNzU5IDEzNS45MDdDMjU3LjQ2NSAxNDkuNTY1IDIzNi45NzkgMTQ5LjU2NSAyMjMuNjg1IDEzNS45MDdMMTEwLjc2NiAxOC43NDAyQzEwNS4yNjIgMTMuMDcwMiAxMDUuMjYyIDQuMzk2MjYgMTEwLjc2NiAtMS4yNzM3NEwyMjMuNjg1IC0xMTguNDQwNEMyMzYuOTc5IC0xMzIuMDk4NSAyNTcuNDY1IC0xMzIuMDk4NSAyNzAuNzU5IC0xMTguNDQwNEwyODMuNjc4IC03LjE3NDI5QzI4OS4xODIgLTEuNTA0MjkgMjg5LjE4MiA3LjE2OTY4IDI4My42NzggMTIuODM5N0wyNzAuNzU5IDEyMy45NjdDMjU3LjQ2NSAxMzcuNjI1IDIzNi45NzkgMTM3LjYyNSAyMjMuNjg1IDEyMy45NjdMMTEwLjc2NiA2LjgwMDE3QzEwNS4yNjIgMS4xMzAxNyAxMDUuMjYyIC03LjU0MzgzIDExMC43NjYgLTEzLjIxMzhMMjIzLjY4NSAtMTMwLjM4MDRDMJM2Ljk3OSAtMTQ0LjAzODUgMjU3LjQ2NSAtMTQ0LjAzODUgMjcwLjc1OSAtMTMwLjM4MDRMJTI4My42NzggLTE5LjExNDNDMjg5LjE4MiAtMTMuNDQ0MyAyODkuMTgyIC00Ljc3MDM3IDI4My42NzggMC44OTk2M0wyNzAuNzU5IDExMi4wMjdDMjU3LjQ2NSAxMjUuNjg1IDIzNi45NzkgMTI1LjY4NSAyMjMuNjg1IDExMi4wMjdMMTEwLjc2NiAtNS4xMzk4M0MxMDUuMjYyIC0xMC44MDk4IDEwNS4yNjIgLTE5LjQ4MzggMTEwLjc2NiAtMjUuMTUzOEwyMjMuNjg1IC0xNDIuMzIwNEMyMzYuOTc5IC0xNTUuOTc4NSAyNTcuNDY1IC0xNTUuOTc4NSAyNzAuNzU5IC0xNDIuMzIwNEwyODMuNjc4IC0zMS4wNTQzQzI4OS4xODIgLTI1LjM4NDMgMjg5LjE4MiAtMTYuNzEwMyAyODMuNjc4IC0xMS4wNDAzTDI3MC43NTkgMTAwLjA4N0MyNTcuNDY1IDExMy43NDUgMjM2Ljk3OSAxMTMuNzQ1IDIyMy42ODUgMTAwLjA4N0wxMTAuNzY2IC0xNy4wNzk4QzEwNS4yNjIgLTIyLjc0OTggMTA1LjI2MiAtMzEuNDIzOCAxMTAuNzY2IC0zNy4wOTM4TDIyMy42ODUgLTE1NC4yNjA0QzIzNi45NzkgLTE2Ny45MTg1IDI1Ny40NjUgLTE2Ny45MTg1IDI3MC43NTkgLTE1NC4yNjA0TDI4My42NzggLTQyLjk5NDNDMjg5LjE4MiAtMzcuMzI0MyAyODkuMTgyIC0yOC42NTAzIDI4My42NzggLTIyLjk4MDNMMjcwLjc1OSA4OC4xNDY3QzI1Ny40NjUgMTAxLjgwNSAyMzYuOTc5IDEwMS44MDUgMjIzLjY4NSA4OC4xNDY3TDExMC43NjYgLTI5LjAxOThDMTA1LjI2MiAtMzQuNjg5OCAxMDUuMjYyIC00My4zNjM4IDExMC43NjYgLTQ5LjAzMzhMMjIzLjY4NSAtMTY2LjIwMDRDMjM2Ljk3OSAtMTc5Ljg1ODUgMjU3LjQ2NSAtMTc5Ljg1ODUgMjcwLjc1OSAtMTY2LjIwMDRMMjgzLjY3OCAtNTQuOTM0M0MyODkuMTgyIC00OS4yNjQzIDI4OS4xODIgLTQwLjU5MDMgMjgzLjY3OCAtMzQuOTIwM0wyNzAuNzU5IDc2LjIwNjdDMjU3LjQ2NSA4OS44NjQ4IDIzNi45NzkgODkuODY0OCAyMjMuNjg1IDc2LjIwNjdMMTEwLjc2NiAtNDAuOTU5OEMxMDUuMjYyIC00Ni42Mjk4IDEwNS4yNjIgLTU1LjMwMzggMTEwLjc2NiAtNjAuOTczOEwyMjMuNjg1IC0xNzguMTQwNEMyMzYuOTc5IC0xOTEuNzk4NSAyNTcuNDY1IC0xOTEuNzk4NSAyNzAuNzU5IC0xNzguMTQwNEwyODMuNjc4IC02Ni44NzQzQzI4OS4xODIgLTYxLjIwNDMgMjg5LjE4MiAtNTIuNTMwMyAyODMuNjc4IC00Ni44NjAzTDI3MC43NTkgNjQuMjY2N0MyNTcuNDY1IDc3LjkyNDggMjM2Ljk3OSA3Ny45MjQ4IDIyMy42ODUgNjQuMjY2N0wxMTAuNzY2IC01Mi44OTk4QzEwNS4yNjIgLTU4LjU2OTggMTA1LjI2MiAtNjcuMjQzOCAxMTAuNzY2IC03Mi45MTM4Ii8+CjwvZ3JhcGg+",
    features: ["sign", "quick-sign", "batch-sign", "mobile"],
  };

  /**
   * Check if WalletConnect is available
   */
  async isAvailable(): Promise<boolean> {
    // WalletConnect is available if we can load the dependencies
    try {
      await import("@walletconnect/sign-client");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create WalletConnect wallet instance
   */
  async createWallet(): Promise<Wallet> {
    const isAvailable = await this.isAvailable();
    if (!isAvailable) {
      throw new Error("WalletConnect dependencies not available");
    }

    return new WalletConnectWallet(this.options);
  }

  /**
   * Create a WalletConnect provider with specific options
   */
  static withOptions(options: WalletConnectOptions): WalletConnectProvider {
    return new WalletConnectProvider(options);
  }
}
