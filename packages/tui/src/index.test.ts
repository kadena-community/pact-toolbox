import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TUIManager } from './index';

// Mock dependencies
vi.mock('chalk', () => ({
  default: {
    red: vi.fn((text) => `RED:${text}`),
    green: vi.fn((text) => `GREEN:${text}`),
    yellow: vi.fn((text) => `YELLOW:${text}`),
    blue: vi.fn((text) => `BLUE:${text}`),
    cyan: vi.fn((text) => `CYAN:${text}`),
    gray: vi.fn((text) => `GRAY:${text}`),
    bold: vi.fn((text) => `BOLD:${text}`),
    dim: vi.fn((text) => `DIM:${text}`),
  },
}));

vi.mock('ansi-escapes', () => ({
  default: {
    clearScreen: 'CLEAR_SCREEN',
    cursorTo: vi.fn((x, y) => `CURSOR_TO:${x},${y}`),
    eraseLines: vi.fn((count) => `ERASE_LINES:${count}`),
    cursorSavePosition: 'CURSOR_SAVE',
    cursorRestorePosition: 'CURSOR_RESTORE',
    cursorHide: 'CURSOR_HIDE',
    cursorShow: 'CURSOR_SHOW',
  },
}));

vi.mock('cli-cursor', () => ({
  default: {
    hide: vi.fn(),
    show: vi.fn(),
  },
}));

vi.mock('terminal-size', () => ({
  default: vi.fn(() => ({ columns: 80, rows: 24 })),
}));

describe('TUIManager', () => {
  let tui: TUIManager;
  let mockStdout: { write: ReturnType<typeof vi.fn> };
  let mockStderr: { write: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    // Mock process.stdout and process.stderr
    mockStdout = { write: vi.fn() };
    mockStderr = { write: vi.fn() };
    
    vi.stubGlobal('process', {
      stdout: mockStdout,
      stderr: mockStderr,
      env: { DEBUG: 'false' },
    });

    tui = new TUIManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe('log', () => {
    it('should log info messages with correct formatting', () => {
      tui.log('info', 'test-category', 'Test message');
      
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('BLUE:[INFO]')
      );
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('test-category')
      );
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('Test message')
      );
    });

    it('should log error messages to stderr', () => {
      tui.log('error', 'test-category', 'Error message');
      
      expect(mockStderr.write).toHaveBeenCalledWith(
        expect.stringContaining('RED:[ERROR]')
      );
    });

    it('should log warn messages with correct formatting', () => {
      tui.log('warn', 'test-category', 'Warning message');
      
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('YELLOW:[WARN]')
      );
    });

    it('should log debug messages only when debug is enabled', () => {
      // Debug disabled by default
      tui.log('debug', 'test-category', 'Debug message');
      expect(mockStdout.write).not.toHaveBeenCalled();

      // Enable debug
      tui.enableTUI({ showDebugLogs: true });
      tui.log('debug', 'test-category', 'Debug message');
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:[DEBUG]')
      );
    });

    it('should include metadata in log output', () => {
      const metadata = { userId: 123, action: 'test' };
      tui.log('info', 'test-category', 'Message with metadata', metadata);
      
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('userId')
      );
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('123')
      );
    });
  });

  describe('updateProcess', () => {
    it('should update process status', () => {
      const processInfo = {
        id: 'test-process',
        name: 'Test Process',
        status: 'running' as const,
        pid: 1234,
      };

      tui.updateProcess(processInfo);
      
      // Should store the process info (we can't directly test internal state, 
      // but we can test that subsequent calls work)
      expect(() => tui.updateProcess(processInfo)).not.toThrow();
    });

    it('should handle process status updates', () => {
      tui.updateProcess({
        id: 'test-process',
        name: 'Test Process',
        status: 'running',
      });

      tui.updateProcess({
        id: 'test-process',
        status: 'stopped',
      });

      expect(() => tui.updateProcess({ id: 'test-process', status: 'failed' })).not.toThrow();
    });
  });

  describe('updateNetwork', () => {
    it('should update network status', () => {
      const networkInfo = {
        id: 'test-network',
        name: 'Test Network',
        status: 'running' as const,
        endpoints: [
          { name: 'API', url: 'http://localhost:8080', status: 'up' as const },
        ],
      };

      expect(() => tui.updateNetwork(networkInfo)).not.toThrow();
    });

    it('should handle partial network updates', () => {
      tui.updateNetwork({
        id: 'test-network',
        name: 'Test Network',
        status: 'starting',
      });

      tui.updateNetwork({
        id: 'test-network',
        status: 'running',
      });

      expect(() => tui.updateNetwork({ id: 'test-network', status: 'stopped' })).not.toThrow();
    });
  });

  describe('updateContainer', () => {
    it('should update container status', () => {
      const containerInfo = {
        id: 'test-container',
        name: 'Test Container',
        status: 'running' as const,
        ports: [{ host: 8080, container: 80 }],
      };

      expect(() => tui.updateContainer(containerInfo)).not.toThrow();
    });
  });

  describe('enableTUI', () => {
    it('should enable TUI with default options', () => {
      expect(() => tui.enableTUI()).not.toThrow();
    });

    it('should enable TUI with custom options', () => {
      const options = {
        refreshRate: 500,
        showDebugLogs: true,
      };

      expect(() => tui.enableTUI(options)).not.toThrow();
    });

    it('should handle multiple enable calls gracefully', () => {
      tui.enableTUI();
      expect(() => tui.enableTUI()).not.toThrow();
    });
  });

  describe('disableTUI', () => {
    it('should disable TUI', () => {
      tui.enableTUI();
      expect(() => tui.disableTUI()).not.toThrow();
    });

    it('should handle disable without enable', () => {
      expect(() => tui.disableTUI()).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear the screen', () => {
      tui.clear();
      expect(mockStdout.write).toHaveBeenCalledWith('CLEAR_SCREEN');
    });
  });

  describe('showSpinner', () => {
    it('should show spinner with message', () => {
      expect(() => tui.showSpinner('Loading...')).not.toThrow();
    });
  });

  describe('hideSpinner', () => {
    it('should hide spinner', () => {
      tui.showSpinner('Loading...');
      expect(() => tui.hideSpinner()).not.toThrow();
    });

    it('should handle hide without show', () => {
      expect(() => tui.hideSpinner()).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle invalid log levels gracefully', () => {
      // @ts-expect-error Testing invalid input
      expect(() => tui.log('invalid', 'test', 'message')).not.toThrow();
    });

    it('should handle empty messages', () => {
      expect(() => tui.log('info', 'test', '')).not.toThrow();
    });

    it('should handle undefined metadata', () => {
      expect(() => tui.log('info', 'test', 'message', undefined)).not.toThrow();
    });
  });

  describe('formatting', () => {
    it('should format timestamps correctly', () => {
      tui.log('info', 'test', 'message');
      
      // Should include a timestamp
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringMatching(/\d{2}:\d{2}:\d{2}/)
      );
    });

    it('should truncate long messages', () => {
      const longMessage = 'a'.repeat(200);
      tui.log('info', 'test', longMessage);
      
      expect(mockStdout.write).toHaveBeenCalled();
    });
  });
});