import { Component, JSX, createSignal, createMemo, For, Show, splitProps } from 'solid-js';
import { css } from 'goober';
import { clsx } from 'clsx';

export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
export interface JsonObject { [key: string]: JsonValue; }
export interface JsonArray extends Array<JsonValue> {}

export type JsonTreeTheme = 'light' | 'dark' | 'auto';

interface JsonTreeProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, 'data'> {
  data: JsonValue;
  expandDepth?: number;
  theme?: JsonTreeTheme;
  showDataTypes?: boolean;
  showObjectSize?: boolean;
  enableClipboard?: boolean;
  sortKeys?: boolean;
  rootName?: string;
}

interface JsonNodeProps {
  data: JsonValue;
  keyName?: string;
  level: number;
  isLast?: boolean;
  expandDepth: number;
  showDataTypes: boolean;
  showObjectSize: boolean;
  sortKeys: boolean;
}

const jsonTreeStyles = css`
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  font-size: var(--pact-font-size-sm);
  line-height: 1.4;
  background-color: var(--pact-color-bg-code);
  border: 1px solid var(--pact-color-border-primary);
  border-radius: var(--pact-border-radius-md);
  padding: var(--pact-spacing-4);
  overflow: auto;
  max-height: 600px;
`;

const nodeContainerStyles = css`
  position: relative;
  margin-left: var(--pact-spacing-4);

  &.root {
    margin-left: 0;
  }
`;

const nodeContentStyles = css`
  display: flex;
  align-items: flex-start;
  gap: var(--pact-spacing-1);
  min-height: 20px;
  padding: var(--pact-spacing-0_5) 0;

  &:hover {
    background-color: var(--pact-color-bg-tertiary);
    border-radius: var(--pact-border-radius-sm);
    margin: 0 calc(-1 * var(--pact-spacing-1));
    padding: var(--pact-spacing-0_5) var(--pact-spacing-1);
  }
`;

const expanderStyles = css`
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  margin-right: var(--pact-spacing-1);
  color: var(--pact-color-text-secondary);
  font-size: 12px;
  min-width: 16px;
  text-align: center;
  border-radius: var(--pact-border-radius-sm);
  transition: all var(--pact-transition-fast) var(--pact-transition-timing);

  &:hover {
    background-color: var(--pact-color-bg-secondary);
    color: var(--pact-color-text-primary);
  }

  &:focus-visible {
    box-shadow: var(--pact-focus-ring);
  }

  &.expanded {
    transform: rotate(90deg);
  }
`;

const keyStyles = css`
  color: var(--pact-color-secondary);
  font-weight: var(--pact-font-weight-medium);
  margin-right: var(--pact-spacing-1);
`;

const colonStyles = css`
  color: var(--pact-color-text-tertiary);
  margin-right: var(--pact-spacing-1);
`;

const valueStyles = css`
  word-break: break-word;
`;

const stringValueStyles = css`
  color: var(--pact-color-success);

  &::before,
  &::after {
    content: '"';
    color: var(--pact-color-text-secondary);
  }
`;

const numberValueStyles = css`
  color: var(--pact-color-primary);
`;

const booleanValueStyles = css`
  color: var(--pact-color-warning);
  font-weight: var(--pact-font-weight-medium);
`;

const nullValueStyles = css`
  color: var(--pact-color-text-muted);
  font-style: italic;
`;

const objectBracketStyles = css`
  color: var(--pact-color-text-primary);
  font-weight: var(--pact-font-weight-bold);
`;

const arrayBracketStyles = css`
  color: var(--pact-color-text-primary);
  font-weight: var(--pact-font-weight-bold);
`;

const dataTypeStyles = css`
  color: var(--pact-color-text-tertiary);
  font-size: var(--pact-font-size-xs);
  margin-left: var(--pact-spacing-2);
  font-style: italic;
`;

const sizeIndicatorStyles = css`
  color: var(--pact-color-text-muted);
  font-size: var(--pact-font-size-xs);
  margin-left: var(--pact-spacing-1);
`;

const copyButtonStyles = css`
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--pact-spacing-0_5);
  margin-left: var(--pact-spacing-1);
  color: var(--pact-color-text-tertiary);
  border-radius: var(--pact-border-radius-sm);
  opacity: 0;
  transition: all var(--pact-transition-fast) var(--pact-transition-timing);

  .node-content:hover & {
    opacity: 1;
  }

  &:hover {
    background-color: var(--pact-color-bg-secondary);
    color: var(--pact-color-text-primary);
  }

  &:focus-visible {
    opacity: 1;
    box-shadow: var(--pact-focus-ring);
  }
`;

const getDataType = (value: JsonValue): string => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
};

// Removed unused _getObjectSize function

const copyToClipboard = async (text: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.warn('Failed to copy to clipboard:', err);
  }
};

const JsonNode: Component<JsonNodeProps> = (props) => {
  const [expanded, setExpanded] = createSignal(props.level < props.expandDepth);

  const isExpandable = () => {
    return (typeof props.data === 'object' && props.data !== null) &&
           (Array.isArray(props.data) ? props.data.length > 0 : Object.keys(props.data).length > 0);
  };

  const dataType = () => getDataType(props.data);

  const handleCopy = () => {
    copyToClipboard(JSON.stringify(props.data, null, 2));
  };

  const renderValue = () => {
    const value = props.data;

    if (value === null) {
      return <span class={clsx(valueStyles, nullValueStyles)}>null</span>;
    }

    if (typeof value === 'string') {
      return <span class={clsx(valueStyles, stringValueStyles)}>{value}</span>;
    }

    if (typeof value === 'number') {
      return <span class={clsx(valueStyles, numberValueStyles)}>{value}</span>;
    }

    if (typeof value === 'boolean') {
      return <span class={clsx(valueStyles, booleanValueStyles)}>{value.toString()}</span>;
    }

    if (Array.isArray(value)) {
      return (
        <span class={arrayBracketStyles}>
          [{props.showObjectSize && <span class={sizeIndicatorStyles}>{value.length}</span>}]
        </span>
      );
    }

    if (typeof value === 'object') {
      return (
        <span class={objectBracketStyles}>
          {'{'}
          {props.showObjectSize && <span class={sizeIndicatorStyles}>{Object.keys(value).length}</span>}
          {'}'}
        </span>
      );
    }

    return <span class={valueStyles}>{String(value)}</span>;
  };

  const renderChildren = () => {
    const value = props.data;

    if (!expanded() || !isExpandable()) return null;

    if (Array.isArray(value)) {
      return (
        <For each={value}>
          {(item, index) => (
            <JsonNode
              data={item}
              keyName={index().toString()}
              level={props.level + 1}
              isLast={index() === value.length - 1}
              expandDepth={props.expandDepth}
              showDataTypes={props.showDataTypes}
              showObjectSize={props.showObjectSize}
              sortKeys={props.sortKeys}
            />
          )}
        </For>
      );
    }

    if (typeof value === 'object' && value !== null) {
      const keys = props.sortKeys ? Object.keys(value).sort() : Object.keys(value);

      return (
        <For each={keys}>
          {(key, index) => (
            <JsonNode
              data={value[key]}
              keyName={key}
              level={props.level + 1}
              isLast={index() === keys.length - 1}
              expandDepth={props.expandDepth}
              showDataTypes={props.showDataTypes}
              showObjectSize={props.showObjectSize}
              sortKeys={props.sortKeys}
            />
          )}
        </For>
      );
    }

    return null;
  };

  return (
    <div class={clsx(nodeContainerStyles, props.level === 0 && 'root')}>
      <div class={clsx(nodeContentStyles, 'node-content')}>
        <Show when={isExpandable()}>
          <button
            class={clsx(expanderStyles, expanded() && 'expanded')}
            onClick={() => setExpanded(!expanded())}
            aria-label={expanded() ? 'Collapse' : 'Expand'}
          >
            ▶
          </button>
        </Show>
        <Show when={!isExpandable()}>
          <span style={{ "min-width": "16px" }}></span>
        </Show>

        <Show when={props.keyName !== undefined}>
          <span class={keyStyles}>{props.keyName}</span>
          <span class={colonStyles}>:</span>
        </Show>

        {renderValue()}

        <Show when={props.showDataTypes}>
          <span class={dataTypeStyles}>{dataType()}</span>
        </Show>

        <button
          class={copyButtonStyles}
          onClick={handleCopy}
          aria-label="Copy value"
          title="Copy to clipboard"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
      </div>

      {renderChildren()}
    </div>
  );
};

export const PactJsonTree: Component<JsonTreeProps> = (props) => {
  const [local, divProps] = splitProps(props, [
    'data',
    'expandDepth',
    'theme',
    'showDataTypes',
    'showObjectSize',
    'enableClipboard',
    'sortKeys',
    'rootName'
  ]);

  const expandDepth = () => local.expandDepth ?? 2;
  const showDataTypes = () => local.showDataTypes ?? false;
  const showObjectSize = () => local.showObjectSize ?? true;
  const sortKeys = () => local.sortKeys ?? false;

  const containerClasses = createMemo(() => clsx(
    jsonTreeStyles,
    divProps.class
  ));

  const handleCopyAll = () => {
    if (local.enableClipboard !== false) {
      copyToClipboard(JSON.stringify(local.data, null, 2));
    }
  };

  return (
    <div {...divProps} class={containerClasses()}>
      <Show when={local.enableClipboard !== false}>
        <div style={{ "display": "flex", "justify-content": "flex-end", "margin-bottom": "var(--pact-spacing-2)" }}>
          <button
            class={copyButtonStyles}
            onClick={handleCopyAll}
            aria-label="Copy entire JSON"
            title="Copy entire JSON to clipboard"
            style={{ "opacity": "1" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy All
          </button>
        </div>
      </Show>

      <JsonNode
        data={local.data}
        keyName={local.rootName}
        level={0}
        expandDepth={expandDepth()}
        showDataTypes={showDataTypes()}
        showObjectSize={showObjectSize()}
        sortKeys={sortKeys()}
      />
    </div>
  );
};