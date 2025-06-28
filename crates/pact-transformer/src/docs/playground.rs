use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Playground configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaygroundConfig {
  /// Enable playground functionality
  pub enabled: bool,

  /// Endpoint for executing Pact code
  pub execution_endpoint: String,

  /// Default timeout for execution (ms)
  pub timeout: u32,

  /// Maximum code size (bytes)
  pub max_code_size: usize,

  /// Enable syntax highlighting
  pub syntax_highlighting: bool,

  /// Enable auto-completion
  pub auto_completion: bool,

  /// Predefined examples
  pub examples: Vec<PlaygroundExample>,

  /// Custom themes
  pub themes: HashMap<String, PlaygroundTheme>,
}

impl Default for PlaygroundConfig {
  fn default() -> Self {
    Self {
      enabled: false,
      execution_endpoint: "/api/pact/execute".to_string(),
      timeout: 5000,
      max_code_size: 100_000,
      syntax_highlighting: true,
      auto_completion: true,
      examples: Vec::new(),
      themes: HashMap::new(),
    }
  }
}

/// Playground example
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaygroundExample {
  pub name: String,
  pub description: String,
  pub code: String,
  pub category: String,
}

/// Playground theme
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaygroundTheme {
  pub editor_bg: String,
  pub editor_fg: String,
  pub syntax_colors: HashMap<String, String>,
}

/// Generate playground HTML component
pub fn generate_playground_html(config: &PlaygroundConfig) -> String {
  format!(
    r#"<div class="pact-playground" data-config='{}'>
    <div class="playground-header">
        <h3>Pact Playground</h3>
        <div class="playground-controls">
            <select class="example-selector">
                <option value="">Select an example...</option>
                {}
            </select>
            <button class="btn-run">Run</button>
            <button class="btn-clear">Clear</button>
            <button class="btn-share">Share</button>
        </div>
    </div>
    
    <div class="playground-body">
        <div class="editor-panel">
            <div class="editor-toolbar">
                <span class="editor-status">Ready</span>
                <div class="editor-actions">
                    <button class="btn-format">Format</button>
                    <button class="btn-settings">Settings</button>
                </div>
            </div>
            <div class="editor-container">
                <textarea class="pact-editor" placeholder="Enter your Pact code here..."></textarea>
            </div>
        </div>
        
        <div class="output-panel">
            <div class="output-tabs">
                <button class="tab-btn active" data-tab="result">Result</button>
                <button class="tab-btn" data-tab="logs">Logs</button>
                <button class="tab-btn" data-tab="gas">Gas Usage</button>
            </div>
            <div class="output-content">
                <div class="tab-content active" id="result">
                    <pre class="output-result"></pre>
                </div>
                <div class="tab-content" id="logs">
                    <pre class="output-logs"></pre>
                </div>
                <div class="tab-content" id="gas">
                    <div class="gas-info"></div>
                </div>
            </div>
        </div>
    </div>
    
    <div class="playground-footer">
        <div class="execution-info">
            <span class="execution-time"></span>
            <span class="execution-gas"></span>
        </div>
    </div>
</div>"#,
    serde_json::to_string(&config).unwrap_or_default(),
    config
      .examples
      .iter()
      .map(|ex| format!(
        r#"<option value="{}" data-category="{}">{}</option>"#,
        html_escape::encode_double_quoted_attribute(&ex.code),
        ex.category,
        ex.name
      ))
      .collect::<Vec<_>>()
      .join("\n                ")
  )
}

/// Generate playground JavaScript
pub fn generate_playground_js() -> &'static str {
  r#"
class PactPlayground {
    constructor(element) {
        this.element = element;
        this.config = JSON.parse(element.dataset.config || '{}');
        this.editor = element.querySelector('.pact-editor');
        this.output = element.querySelector('.output-result');
        this.logsOutput = element.querySelector('.output-logs');
        this.gasInfo = element.querySelector('.gas-info');
        this.status = element.querySelector('.editor-status');
        
        this.init();
    }
    
    init() {
        // Setup event listeners
        this.element.querySelector('.btn-run').addEventListener('click', () => this.run());
        this.element.querySelector('.btn-clear').addEventListener('click', () => this.clear());
        this.element.querySelector('.btn-share').addEventListener('click', () => this.share());
        this.element.querySelector('.btn-format').addEventListener('click', () => this.format());
        
        // Example selector
        const selector = this.element.querySelector('.example-selector');
        if (selector) {
            selector.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.editor.value = e.target.value;
                }
            });
        }
        
        // Tab switching
        this.element.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
        
        // Keyboard shortcuts
        this.editor.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.run();
                } else if (e.key === 's') {
                    e.preventDefault();
                    this.format();
                }
            }
        });
        
        // Syntax highlighting (if enabled)
        if (this.config.syntax_highlighting) {
            this.setupSyntaxHighlighting();
        }
        
        // Auto-completion (if enabled)
        if (this.config.auto_completion) {
            this.setupAutoCompletion();
        }
    }
    
    async run() {
        const code = this.editor.value.trim();
        if (!code) {
            this.showError('Please enter some Pact code');
            return;
        }
        
        if (code.length > this.config.max_code_size) {
            this.showError(`Code too large (max ${this.config.max_code_size} bytes)`);
            return;
        }
        
        this.setStatus('Running...');
        this.clearOutput();
        
        const startTime = Date.now();
        
        try {
            const response = await fetch(this.config.execution_endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    code: code,
                    env: this.getEnvironment()
                }),
                signal: AbortSignal.timeout(this.config.timeout)
            });
            
            const result = await response.json();
            const executionTime = Date.now() - startTime;
            
            if (result.success) {
                this.showResult(result);
                this.updateExecutionInfo(executionTime, result.gas);
                this.setStatus('Success');
            } else {
                this.showError(result.error || 'Execution failed');
                this.setStatus('Error', 'error');
            }
            
            // Show logs if any
            if (result.logs && result.logs.length > 0) {
                this.showLogs(result.logs);
            }
            
            // Show gas usage
            if (result.gas) {
                this.showGasUsage(result.gas);
            }
            
        } catch (error) {
            if (error.name === 'AbortError') {
                this.showError('Execution timed out');
            } else {
                this.showError(`Error: ${error.message}`);
            }
            this.setStatus('Error', 'error');
        }
    }
    
    clear() {
        this.editor.value = '';
        this.clearOutput();
        this.setStatus('Ready');
    }
    
    clearOutput() {
        this.output.textContent = '';
        this.logsOutput.textContent = '';
        this.gasInfo.innerHTML = '';
        this.element.querySelector('.execution-time').textContent = '';
        this.element.querySelector('.execution-gas').textContent = '';
    }
    
    async share() {
        const code = this.editor.value.trim();
        if (!code) {
            alert('Nothing to share');
            return;
        }
        
        try {
            const url = await this.createShareableLink(code);
            await navigator.clipboard.writeText(url);
            this.setStatus('Link copied!', 'success');
            setTimeout(() => this.setStatus('Ready'), 2000);
        } catch (error) {
            alert('Failed to create shareable link');
        }
    }
    
    async format() {
        const code = this.editor.value.trim();
        if (!code) return;
        
        try {
            const response = await fetch('/api/pact/format', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });
            
            if (response.ok) {
                const { formatted } = await response.json();
                this.editor.value = formatted;
                this.setStatus('Formatted', 'success');
                setTimeout(() => this.setStatus('Ready'), 1000);
            }
        } catch (error) {
            console.error('Format error:', error);
        }
    }
    
    showResult(result) {
        if (typeof result.output === 'object') {
            this.output.textContent = JSON.stringify(result.output, null, 2);
        } else {
            this.output.textContent = result.output;
        }
    }
    
    showError(message) {
        this.output.innerHTML = `<span class="error">${this.escapeHtml(message)}</span>`;
    }
    
    showLogs(logs) {
        this.logsOutput.textContent = logs.join('\n');
        
        // Show indicator on logs tab
        const logsTab = this.element.querySelector('[data-tab="logs"]');
        if (logsTab && !logsTab.classList.contains('active')) {
            logsTab.classList.add('has-content');
        }
    }
    
    showGasUsage(gas) {
        this.gasInfo.innerHTML = `
            <div class="gas-item">
                <span class="gas-label">Total Gas:</span>
                <span class="gas-value">${gas.total || 0}</span>
            </div>
            <div class="gas-item">
                <span class="gas-label">Compute:</span>
                <span class="gas-value">${gas.compute || 0}</span>
            </div>
            <div class="gas-item">
                <span class="gas-label">Memory:</span>
                <span class="gas-value">${gas.memory || 0}</span>
            </div>
            <div class="gas-item">
                <span class="gas-label">Storage:</span>
                <span class="gas-value">${gas.storage || 0}</span>
            </div>
        `;
    }
    
    updateExecutionInfo(time, gas) {
        this.element.querySelector('.execution-time').textContent = `Time: ${time}ms`;
        if (gas && gas.total) {
            this.element.querySelector('.execution-gas').textContent = `Gas: ${gas.total}`;
        }
    }
    
    setStatus(text, type = 'normal') {
        this.status.textContent = text;
        this.status.className = `editor-status ${type}`;
    }
    
    switchTab(tabName) {
        // Update tab buttons
        this.element.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Update tab content
        this.element.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabName);
        });
    }
    
    getEnvironment() {
        // Get any environment settings from the UI
        return {
            chainId: '0',
            gasLimit: 150000,
            gasPrice: 0.0000001
        };
    }
    
    async createShareableLink(code) {
        const compressed = btoa(encodeURIComponent(code));
        const url = new URL(window.location.href);
        url.searchParams.set('code', compressed);
        return url.toString();
    }
    
    setupSyntaxHighlighting() {
        // This would integrate with a syntax highlighting library
        // For now, just a placeholder
    }
    
    setupAutoCompletion() {
        // This would integrate with an auto-completion library
        // For now, just a placeholder
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize all playgrounds on the page
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.pact-playground').forEach(element => {
        new PactPlayground(element);
    });
    
    // Check for shared code in URL
    const urlParams = new URLSearchParams(window.location.search);
    const sharedCode = urlParams.get('code');
    if (sharedCode) {
        try {
            const code = decodeURIComponent(atob(sharedCode));
            const playground = document.querySelector('.pact-playground .pact-editor');
            if (playground) {
                playground.value = code;
            }
        } catch (e) {
            console.error('Invalid shared code');
        }
    }
});"#
}

/// Generate playground CSS
pub fn generate_playground_css() -> &'static str {
  r#".pact-playground {
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    overflow: hidden;
    margin: 1rem 0;
}

.playground-header {
    background: var(--sidebar-bg);
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.playground-header h3 {
    margin: 0;
    font-size: 1.1rem;
}

.playground-controls {
    display: flex;
    gap: 0.5rem;
}

.playground-controls button,
.playground-controls select {
    padding: 0.375rem 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 0.25rem;
    background: var(--bg-color);
    color: var(--text-color);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
}

.playground-controls button:hover {
    background: var(--primary-color);
    color: white;
    border-color: var(--primary-color);
}

.playground-body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    height: 400px;
}

.editor-panel,
.output-panel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.editor-panel {
    border-right: 1px solid var(--border-color);
}

.editor-toolbar {
    background: var(--code-bg);
    padding: 0.5rem 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border-color);
}

.editor-status {
    font-size: 0.875rem;
    color: var(--text-color);
}

.editor-status.error {
    color: #ef4444;
}

.editor-status.success {
    color: #10b981;
}

.editor-actions {
    display: flex;
    gap: 0.5rem;
}

.editor-actions button {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 0.25rem;
    background: transparent;
    color: var(--text-color);
    cursor: pointer;
}

.editor-container {
    flex: 1;
    position: relative;
}

.pact-editor {
    width: 100%;
    height: 100%;
    padding: 1rem;
    border: none;
    background: var(--bg-color);
    color: var(--text-color);
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 0.875rem;
    resize: none;
    outline: none;
}

.output-tabs {
    display: flex;
    background: var(--code-bg);
    border-bottom: 1px solid var(--border-color);
}

.tab-btn {
    padding: 0.5rem 1rem;
    border: none;
    background: transparent;
    color: var(--text-color);
    cursor: pointer;
    position: relative;
    font-size: 0.875rem;
}

.tab-btn.active {
    background: var(--bg-color);
    border-bottom: 2px solid var(--primary-color);
}

.tab-btn.has-content::after {
    content: '';
    position: absolute;
    top: 50%;
    right: 0.5rem;
    width: 6px;
    height: 6px;
    background: var(--secondary-color);
    border-radius: 50%;
    transform: translateY(-50%);
}

.output-content {
    flex: 1;
    position: relative;
    overflow: auto;
}

.tab-content {
    display: none;
    height: 100%;
    padding: 1rem;
}

.tab-content.active {
    display: block;
}

.output-result,
.output-logs {
    margin: 0;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 0.875rem;
    white-space: pre-wrap;
    word-break: break-all;
}

.output-result .error {
    color: #ef4444;
}

.gas-info {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
}

.gas-item {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem;
    background: var(--code-bg);
    border-radius: 0.25rem;
}

.gas-label {
    font-weight: 600;
}

.gas-value {
    font-family: monospace;
}

.playground-footer {
    background: var(--sidebar-bg);
    padding: 0.5rem 1rem;
    border-top: 1px solid var(--border-color);
}

.execution-info {
    display: flex;
    gap: 1rem;
    font-size: 0.875rem;
    color: var(--text-color);
}

@media (max-width: 768px) {
    .playground-body {
        grid-template-columns: 1fr;
        height: 600px;
    }
    
    .editor-panel {
        border-right: none;
        border-bottom: 1px solid var(--border-color);
    }
}"#
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_playground_config() {
    let config = PlaygroundConfig::default();
    assert!(!config.enabled);
    assert_eq!(config.timeout, 5000);
    assert_eq!(config.execution_endpoint, "/api/pact/execute");
  }

  #[test]
  fn test_playground_html_generation() {
    let mut config = PlaygroundConfig::default();
    config.examples.push(PlaygroundExample {
      name: "Hello World".to_string(),
      description: "Basic example".to_string(),
      code: "(+ 1 2)".to_string(),
      category: "basics".to_string(),
    });

    let html = generate_playground_html(&config);
    assert!(html.contains("pact-playground"));
    assert!(html.contains("Hello World"));
    assert!(html.contains("data-category=\"basics\""));
  }
}
