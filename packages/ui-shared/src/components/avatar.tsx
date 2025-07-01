import { Component, JSX, Show, splitProps, createMemo, createSignal } from 'solid-js';
import { css } from 'goober';
import { clsx } from 'clsx';

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
export type AvatarShape = "circle" | "square";
export type AvatarStatus = "online" | "offline" | "busy" | "away";

interface AvatarProps extends JSX.HTMLAttributes<HTMLDivElement> {
  size?: AvatarSize;
  shape?: AvatarShape;
  src?: string;
  alt?: string;
  name?: string;
  status?: AvatarStatus;
  showStatus?: boolean;
  fallbackColor?: string;
}

const avatarContainerStyles = css`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: var(--pact-color-bg-secondary);
  color: var(--pact-color-text-primary);
  font-weight: var(--pact-font-weight-medium);
  overflow: hidden;
  flex-shrink: 0;
`;

const avatarImageStyles = css`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

const avatarFallbackStyles = css`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background-color: var(--pact-color-primary);
  color: var(--pact-color-text-inverse);
  text-transform: uppercase;
  user-select: none;
`;

const avatarStatusIndicatorStyles = css`
  position: absolute;
  border: 2px solid var(--pact-color-bg-primary);
  border-radius: 50%;
`;

// Size styles
const avatarSizeXs = css`
  width: 24px;
  height: 24px;
  font-size: var(--pact-font-size-xs);

  .status {
    width: 8px;
    height: 8px;
    bottom: -1px;
    right: -1px;
  }
`;

const avatarSizeSm = css`
  width: 32px;
  height: 32px;
  font-size: var(--pact-font-size-sm);

  .status {
    width: 10px;
    height: 10px;
    bottom: -1px;
    right: -1px;
  }
`;

const avatarSizeMd = css`
  width: 40px;
  height: 40px;
  font-size: var(--pact-font-size-base);

  .status {
    width: 12px;
    height: 12px;
    bottom: 0;
    right: 0;
  }
`;

const avatarSizeLg = css`
  width: 48px;
  height: 48px;
  font-size: var(--pact-font-size-lg);

  .status {
    width: 14px;
    height: 14px;
    bottom: 1px;
    right: 1px;
  }
`;

const avatarSizeXl = css`
  width: 64px;
  height: 64px;
  font-size: var(--pact-font-size-xl);

  .status {
    width: 18px;
    height: 18px;
    bottom: 2px;
    right: 2px;
  }
`;

// Shape styles
const avatarShapeCircle = css`
  border-radius: 50%;
`;

const avatarShapeSquare = css`
  border-radius: var(--pact-border-radius-base);
`;

// Status styles
const statusOnline = css`
  background-color: var(--pact-color-success);
`;

const statusOffline = css`
  background-color: var(--pact-color-gray-500);
`;

const statusBusy = css`
  background-color: var(--pact-color-error);
`;

const statusAway = css`
  background-color: var(--pact-color-warning);
`;

const generateInitials = (name: string): string => {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].charAt(0);
  }
  return words[0].charAt(0) + words[words.length - 1].charAt(0);
};

const generateFallbackColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  const colors = [
    '#ef4444', // red
    '#f97316', // orange
    '#f59e0b', // amber
    '#eab308', // yellow
    '#84cc16', // lime
    '#22c55e', // green
    '#10b981', // emerald
    '#14b8a6', // teal
    '#06b6d4', // cyan
    '#0ea5e9', // sky
    '#3b82f6', // blue
    '#6366f1', // indigo
    '#8b5cf6', // violet
    '#a855f7', // purple
    '#d946ef', // fuchsia
    '#ec4899', // pink
    '#f43f5e'  // rose
  ];

  return colors[Math.abs(hash) % colors.length];
};

export const PactAvatar: Component<AvatarProps> = (props) => {
  const [local, otherProps] = splitProps(props, [
    'size',
    'shape',
    'src',
    'alt',
    'name',
    'status',
    'showStatus',
    'fallbackColor',
    'class'
  ]);

  const size = () => local.size || 'md';
  const shape = () => local.shape || 'circle';
  const showStatus = () => local.showStatus ?? false;
  const name = () => local.name || '';
  const [imageError, setImageError] = createSignal(false);

  const initials = createMemo(() => {
    if (!name()) return '';
    return generateInitials(name());
  });

  const fallbackColor = createMemo(() => {
    if (local.fallbackColor) return local.fallbackColor;
    if (!name()) return 'var(--pact-color-primary)';
    return generateFallbackColor(name());
  });

  const avatarClasses = createMemo(() => clsx(
    avatarContainerStyles,
    size() === 'xs' && avatarSizeXs,
    size() === 'sm' && avatarSizeSm,
    size() === 'md' && avatarSizeMd,
    size() === 'lg' && avatarSizeLg,
    size() === 'xl' && avatarSizeXl,
    shape() === 'circle' && avatarShapeCircle,
    shape() === 'square' && avatarShapeSquare,
    local.class
  ));

  const statusClasses = createMemo(() => clsx(
    avatarStatusIndicatorStyles,
    'status',
    local.status === 'online' && statusOnline,
    local.status === 'offline' && statusOffline,
    local.status === 'busy' && statusBusy,
    local.status === 'away' && statusAway
  ));

  const fallbackStyles = createMemo(() => css`
    background-color: ${fallbackColor()};
  `);

  const handleImageError = () => {
    setImageError(true);
  };

  const shouldShowImage = createMemo(() => local.src && !imageError());

  return (
    <div
      class={avatarClasses()}
      role="img"
      aria-label={local.alt || name() || 'Avatar'}
      {...otherProps}
    >
      <Show
        when={shouldShowImage()}
        fallback={
          <div class={clsx(avatarFallbackStyles, fallbackStyles())}>
            {initials()}
          </div>
        }
      >
        <img
          src={local.src}
          alt={local.alt || name() || 'Avatar'}
          class={avatarImageStyles}
          onError={handleImageError}
        />
      </Show>
      <Show when={showStatus() && local.status}>
        <div
          class={statusClasses()}
          aria-label={`Status: ${local.status}`}
        />
      </Show>
    </div>
  );
};