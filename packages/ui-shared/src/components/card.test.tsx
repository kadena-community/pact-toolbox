import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { PactCard } from './card';

describe('PactCard', () => {
  it('renders children content', () => {
    render(() => (
      <PactCard>
        <p>Card content</p>
      </PactCard>
    ));
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  describe('padding variants', () => {
    it('applies default padding (md)', () => {
      const { container } = render(() => <PactCard>Content</PactCard>);
      const card = container.firstChild;
      expect(card).toBeInTheDocument();
    });

    it('applies no padding', () => {
      const { container } = render(() => <PactCard padding="none">Content</PactCard>);
      const card = container.firstChild;
      expect(card).toBeInTheDocument();
    });

    it('applies small padding', () => {
      const { container } = render(() => <PactCard padding="sm">Content</PactCard>);
      const card = container.firstChild;
      expect(card).toBeInTheDocument();
    });

    it('applies large padding', () => {
      const { container } = render(() => <PactCard padding="lg">Content</PactCard>);
      const card = container.firstChild;
      expect(card).toBeInTheDocument();
    });
  });

  describe('interactive states', () => {
    it('applies hoverable state', () => {
      const { container } = render(() => <PactCard hoverable>Hoverable</PactCard>);
      const card = container.firstChild;
      expect(card).toBeInTheDocument();
    });

    it('applies clickable state', () => {
      const { container } = render(() => <PactCard clickable>Clickable</PactCard>);
      const card = container.firstChild;
      expect(card).toBeInTheDocument();
    });

    it('applies both hoverable and clickable states', () => {
      const { container } = render(() => (
        <PactCard hoverable clickable>
          Interactive
        </PactCard>
      ));
      const card = container.firstChild;
      expect(card).toBeInTheDocument();
    });
  });

  describe('sections', () => {
    it('renders with header', () => {
      render(() => (
        <PactCard header={<h2>Card Header</h2>}>
          <p>Card body</p>
        </PactCard>
      ));
      expect(screen.getByText('Card Header')).toBeInTheDocument();
      expect(screen.getByText('Card body')).toBeInTheDocument();
    });

    it('renders with footer', () => {
      render(() => (
        <PactCard footer={<div>Card Footer</div>}>
          <p>Card body</p>
        </PactCard>
      ));
      expect(screen.getByText('Card Footer')).toBeInTheDocument();
      expect(screen.getByText('Card body')).toBeInTheDocument();
    });

    it('renders with header and footer', () => {
      render(() => (
        <PactCard
          header={<h2>Header</h2>}
          footer={<div>Footer</div>}
        >
          <p>Body</p>
        </PactCard>
      ));
      expect(screen.getByText('Header')).toBeInTheDocument();
      expect(screen.getByText('Body')).toBeInTheDocument();
      expect(screen.getByText('Footer')).toBeInTheDocument();
    });
  });

  describe('HTML attributes', () => {
    it('passes through HTML div attributes', () => {
      render(() => (
        <PactCard
          id="test-card"
          data-testid="custom-card"
          class="custom-class"
        >
          Content
        </PactCard>
      ));

      const card = document.getElementById('test-card');
      expect(card).toBeInTheDocument();
      expect(card).toHaveAttribute('data-testid', 'custom-card');
      expect(card).toHaveClass('custom-class');
    });
  });
});