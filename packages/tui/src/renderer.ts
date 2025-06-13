import chalk from "chalk";
import ansiEscapes from "ansi-escapes";
import cliCursor from "cli-cursor";
import terminalSize from "terminal-size";
import stripAnsi from "strip-ansi";
import wrapAnsi from "wrap-ansi";
import type { TUIState, TUIOptions, TUITheme } from "./types";

export class TUIRenderer {
  private theme: TUITheme;
  private width: number;
  private height: number;

  constructor(options: Required<TUIOptions>) {
    this.theme = options.theme;
    this.width = options.width;
    this.height = options.height;
  }

  updateDimensions(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  hideCursor(): void {
    process.stdout.write(cliCursor.hide);
  }

  showCursor(): void {
    process.stdout.write(cliCursor.show);
  }

  clearScreen(): void {
    process.stdout.write(ansiEscapes.clearScreen);
    process.stdout.write(ansiEscapes.cursorTo(0, 0));
  }

  write(content: string): void {
    process.stdout.write(ansiEscapes.cursorTo(0, 0));
    process.stdout.write(content);
  }

  render(state: TUIState): string {
    const sections: string[] = [];

    // Header
    sections.push(this.renderHeader(state));

    // Status overview
    sections.push(this.renderStatus(state.status));

    // Network section
    if (state.network.name) {
      sections.push(this.renderNetwork(state.network));
    }

    // Processes section
    if (state.processes.length > 0) {
      sections.push(this.renderProcesses(state.processes));
    }

    // Containers section
    if (state.containers.length > 0) {
      sections.push(this.renderContainers(state.containers));
    }

    // Logs section
    if (state.logs.length > 0) {
      sections.push(this.renderLogs(state.logs));
    }

    // Footer with controls
    sections.push(this.renderFooter());

    return sections.join("\n\n");
  }

  private renderHeader(state: TUIState): string {
    const title = chalk.hex(this.theme.colors.primary).bold("Pact Toolbox DevNet Monitor");
    const subtitle = chalk.hex(this.theme.colors.muted)(
      `Last updated: ${state.lastUpdate.toLocaleTimeString()}`
    );
    const separator = chalk.hex(this.theme.colors.muted)("─".repeat(this.width));

    return [title, subtitle, separator].join("\n");
  }

  private renderStatus(status: TUIState["status"]): string {
    const title = chalk.hex(this.theme.colors.secondary).bold("System Status");
    
    const uptimeStr = this.formatUptime(status.uptime);
    const networkSymbol = this.getStatusSymbol(status.networkStatus);
    const networkColor = this.getStatusColor(status.networkStatus);

    const stats = [
      `Uptime: ${chalk.hex(this.theme.colors.info)(uptimeStr)}`,
      `Processes: ${chalk.hex(this.theme.colors.success)(status.runningProcesses)}/${status.totalProcesses}`,
      `Containers: ${chalk.hex(this.theme.colors.success)(status.runningContainers)}/${status.totalContainers}`,
      `Network: ${networkColor(networkSymbol + " " + status.networkStatus)}`,
    ];

    if (status.systemResources) {
      stats.push(
        `CPU: ${this.formatPercentage(status.systemResources.cpu)}`,
        `Memory: ${this.formatPercentage(status.systemResources.memory)}`,
        `Disk: ${this.formatPercentage(status.systemResources.disk)}`
      );
    }

    return [title, stats.join("  |  ")].join("\n");
  }

  private renderNetwork(network: TUIState["network"]): string {
    const title = chalk.hex(this.theme.colors.secondary).bold("Network");
    const statusColor = this.getStatusColor(network.status);
    const statusSymbol = this.getStatusSymbol(network.status);

    const networkInfo = [
      `${statusColor(statusSymbol)} ${chalk.bold(network.name)} (${network.id.substring(0, 8)})`,
      `Status: ${statusColor(network.status.toUpperCase())}`,
    ];

    const endpointLines = network.endpoints.map(endpoint => {
      const endpointColor = this.getStatusColor(endpoint.status === "up" ? "running" : "failed");
      const endpointSymbol = endpoint.status === "up" ? this.theme.symbols.success : this.theme.symbols.error;
      const responseTime = endpoint.responseTime ? ` (${endpoint.responseTime}ms)` : "";
      
      return `  ${endpointColor(endpointSymbol)} ${endpoint.name}: ${chalk.hex(this.theme.colors.info)(endpoint.url)}${responseTime}`;
    });

    if (network.stats) {
      const stats = [];
      if (network.stats.totalRequests) stats.push(`Requests: ${network.stats.totalRequests.toLocaleString()}`);
      if (network.stats.errorRate) stats.push(`Error Rate: ${(network.stats.errorRate * 100).toFixed(2)}%`);
      if (network.stats.avgResponseTime) stats.push(`Avg Response: ${network.stats.avgResponseTime.toFixed(0)}ms`);
      
      if (stats.length > 0) {
        endpointLines.push(`  Stats: ${stats.join(" | ")}`);
      }
    }

    return [title, ...networkInfo, ...endpointLines].join("\n");
  }

  private renderProcesses(processes: TUIState["processes"]): string {
    const title = chalk.hex(this.theme.colors.secondary).bold("Processes");
    
    const processLines = processes.map(process => {
      const statusColor = this.getStatusColor(process.status);
      const statusSymbol = this.getStatusSymbol(process.status);
      
      const uptimeStr = process.uptime ? this.formatUptime(process.uptime) : "N/A";
      const pidStr = process.pid ? `PID: ${process.pid}` : "No PID";
      
      const resourceInfo = [];
      if (process.cpu !== undefined) resourceInfo.push(`CPU: ${process.cpu.toFixed(1)}%`);
      if (process.memory !== undefined) resourceInfo.push(`MEM: ${(process.memory / 1024 / 1024).toFixed(0)}MB`);
      
      const resourceStr = resourceInfo.length > 0 ? ` | ${resourceInfo.join(" ")}` : "";

      return [
        `${statusColor(statusSymbol)} ${chalk.bold(process.name)}`,
        `  ${statusColor(process.status.toUpperCase())} | ${pidStr} | Uptime: ${uptimeStr}${resourceStr}`,
        process.command ? `  Command: ${chalk.hex(this.theme.colors.muted)(process.command)} ${process.args?.join(" ") || ""}` : "",
      ].filter(Boolean).join("\n");
    });

    return [title, ...processLines].join("\n");
  }

  private renderContainers(containers: TUIState["containers"]): string {
    const title = chalk.hex(this.theme.colors.secondary).bold("Containers");
    
    const containerLines = containers.map(container => {
      const statusColor = this.getStatusColor(container.status);
      const statusSymbol = this.getStatusSymbol(container.status);
      
      const healthInfo = container.health ? 
        ` | Health: ${this.getStatusColor(container.health === "healthy" ? "running" : "failed")(container.health)}` : "";
      
      const portsStr = container.ports.length > 0 ? 
        `Ports: ${container.ports.join(", ")}` : "No ports";

      return [
        `${statusColor(statusSymbol)} ${chalk.bold(container.name)}`,
        `  ${statusColor(container.status.toUpperCase())} | ${chalk.hex(this.theme.colors.info)(container.image)}${healthInfo}`,
        `  ${portsStr}`,
      ].join("\n");
    });

    return [title, ...containerLines].join("\n");
  }

  private renderLogs(logs: TUIState["logs"]): string {
    const title = chalk.hex(this.theme.colors.secondary).bold("Recent Logs");
    const maxLines = Math.min(10, Math.floor(this.height / 4));
    const recentLogs = logs.slice(-maxLines);
    
    const logLines = recentLogs.map(log => {
      const levelColor = this.getLogLevelColor(log.level);
      const timestamp = chalk.hex(this.theme.colors.muted)(log.timestamp.toLocaleTimeString());
      const source = chalk.hex(this.theme.colors.info)(`[${log.source}]`);
      const message = wrapAnsi(log.message, this.width - 30, { trim: false });
      
      return `${timestamp} ${levelColor(log.level.toUpperCase().padEnd(5))} ${source} ${message}`;
    });

    return [title, ...logLines].join("\n");
  }

  private renderFooter(): string {
    const controls = [
      "Q: Quit",
      "R: Refresh",
      "↑/↓: Navigate",
      "Ctrl+C: Force exit",
    ];
    
    return chalk.hex(this.theme.colors.muted)("Controls: " + controls.join(" | "));
  }

  private getStatusColor(status: string): (text: string) => string {
    switch (status) {
      case "running":
      case "up":
      case "healthy":
        return chalk.hex(this.theme.colors.success);
      case "starting":
      case "checking":
        return chalk.hex(this.theme.colors.warning);
      case "stopped":
      case "down":
        return chalk.hex(this.theme.colors.muted);
      case "failed":
      case "crashed":
      case "unhealthy":
        return chalk.hex(this.theme.colors.error);
      case "degraded":
        return chalk.hex(this.theme.colors.warning);
      default:
        return chalk.hex(this.theme.colors.foreground);
    }
  }

  private getStatusSymbol(status: string): string {
    switch (status) {
      case "running":
      case "up":
        return this.theme.symbols.running;
      case "stopped":
      case "down":
        return this.theme.symbols.stopped;
      case "failed":
      case "crashed":
        return this.theme.symbols.error;
      case "starting":
      case "checking":
        return this.theme.symbols.loading;
      case "healthy":
        return this.theme.symbols.success;
      case "unhealthy":
        return this.theme.symbols.error;
      default:
        return this.theme.symbols.info;
    }
  }

  private getLogLevelColor(level: string): (text: string) => string {
    switch (level) {
      case "error":
        return chalk.hex(this.theme.colors.error);
      case "warn":
        return chalk.hex(this.theme.colors.warning);
      case "info":
        return chalk.hex(this.theme.colors.info);
      case "debug":
        return chalk.hex(this.theme.colors.muted);
      default:
        return chalk.hex(this.theme.colors.foreground);
    }
  }

  private formatUptime(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  private formatPercentage(value: number): string {
    const color = value > 80 ? this.theme.colors.error :
                  value > 60 ? this.theme.colors.warning :
                  this.theme.colors.success;
    return chalk.hex(color)(`${value.toFixed(1)}%`);
  }
}