import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { PactBadge } from './badge';

describe('PactBadge', () => {
  it('renders with text content', () => {
    render(() => <PactBadge>New</PactBadge>);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  describe('variants', () => {
    it('renders default variant by default', () => {
      render(() => <PactBadge>Default</PactBadge>);
      expect(screen.getByText('Default')).toBeInTheDocument();
    });

    it('renders primary variant', () => {
      render(() => <PactBadge variant="primary">Primary</PactBadge>);
      expect(screen.getByText('Primary')).toBeInTheDocument();
    });

    it('renders success variant', () => {
      render(() => <PactBadge variant="success">Success</PactBadge>);
      expect(screen.getByText('Success')).toBeInTheDocument();
    });

    it('renders error variant', () => {
      render(() => <PactBadge variant="error">Error</PactBadge>);
      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('renders warning variant', () => {
      render(() => <PactBadge variant="warning">Warning</PactBadge>);
      expect(screen.getByText('Warning')).toBeInTheDocument();
    });

    it('renders info variant', () => {
      render(() => <PactBadge variant="info">Info</PactBadge>);
      expect(screen.getByText('Info')).toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it('renders medium size by default', () => {
      render(() => <PactBadge>Medium</PactBadge>);
      expect(screen.getByText('Medium')).toBeInTheDocument();
    });

    it('renders small size', () => {
      render(() => <PactBadge size="sm">Small</PactBadge>);
      expect(screen.getByText('Small')).toBeInTheDocument();
    });

    it('renders large size', () => {
      render(() => <PactBadge size="lg">Large</PactBadge>);
      expect(screen.getByText('Large')).toBeInTheDocument();
    });
  });

  describe('HTML attributes', () => {
    it('passes through HTML span attributes', () => {
      render(() => (
        <PactBadge
          id="test-badge"
          data-testid="custom-badge"
          class="custom-class"
        >
          Badge
        </PactBadge>
      ));

      const badge = document.getElementById('test-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('data-testid', 'custom-badge');
      expect(badge).toHaveClass('custom-class');
    });
  });

  describe('content', () => {
    it('renders with number content', () => {
      render(() => <PactBadge>{42}</PactBadge>);
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('renders with complex content', () => {
      render(() => (
        <PactBadge>
          <span>Complex</span> <span>Content</span>
        </PactBadge>
      ));
      expect(screen.getByText('Complex')).toBeInTheDocument();
      expect(screen.getByText('Content')).toBeInTheDocument();
    });
  });
});