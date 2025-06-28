import { css } from 'lit';

export const animations = css`
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes fadeOut {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }

  @keyframes slideIn {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  @keyframes slideOut {
    from {
      transform: translateY(0);
    }
    to {
      transform: translateY(100%);
    }
  }

  @keyframes slideInRight {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }

  @keyframes slideOutRight {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(100%);
    }
  }

  @keyframes scaleIn {
    from {
      transform: scale(0.9);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  @keyframes scaleOut {
    from {
      transform: scale(1);
      opacity: 1;
    }
    to {
      transform: scale(0.9);
      opacity: 0;
    }
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  @keyframes bounce {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-25%);
    }
  }

  @keyframes shake {
    0%, 100% {
      transform: translateX(0);
    }
    10%, 30%, 50%, 70%, 90% {
      transform: translateX(-2px);
    }
    20%, 40%, 60%, 80% {
      transform: translateX(2px);
    }
  }

  /* Animation utility classes */
  .animate-fadeIn {
    animation: fadeIn var(--pact-transition-base) var(--pact-transition-timing);
  }

  .animate-fadeOut {
    animation: fadeOut var(--pact-transition-base) var(--pact-transition-timing);
  }

  .animate-slideIn {
    animation: slideIn var(--pact-transition-slow) var(--pact-transition-timing);
  }

  .animate-slideOut {
    animation: slideOut var(--pact-transition-slow) var(--pact-transition-timing);
  }

  .animate-scaleIn {
    animation: scaleIn var(--pact-transition-base) var(--pact-transition-timing);
  }

  .animate-scaleOut {
    animation: scaleOut var(--pact-transition-base) var(--pact-transition-timing);
  }

  .animate-spin {
    animation: spin 1s linear infinite;
  }

  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  .animate-bounce {
    animation: bounce 1s infinite;
  }

  .animate-shake {
    animation: shake 0.5s var(--pact-transition-timing);
  }
`;