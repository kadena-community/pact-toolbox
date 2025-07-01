import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { PactButton } from './button';

describe('PactButton', () => {
  it('renders with children', () => {
    render(() => <PactButton>Click me</PactButton>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  describe('variants', () => {
    it('renders primary variant by default', () => {
      const { container } = render(() => <PactButton>Primary</PactButton>);
      const button = container.querySelector('button');
      expect(button).toBeInTheDocument();
    });

    it('renders secondary variant', () => {
      render(() => <PactButton variant="secondary">Secondary</PactButton>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('renders ghost variant', () => {
      render(() => <PactButton variant="ghost">Ghost</PactButton>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('renders danger variant', () => {
      render(() => <PactButton variant="danger">Danger</PactButton>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('renders outline variant', () => {
      render(() => <PactButton variant="outline">Outline</PactButton>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('renders link variant', () => {
      render(() => <PactButton variant="link">Link</PactButton>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it('renders with xs size', () => {
      render(() => <PactButton size="xs">Extra Small</PactButton>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('renders with sm size', () => {
      render(() => <PactButton size="sm">Small</PactButton>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('renders with md size by default', () => {
      render(() => <PactButton>Medium</PactButton>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('renders with lg size', () => {
      render(() => <PactButton size="lg">Large</PactButton>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('renders with xl size', () => {
      render(() => <PactButton size="xl">Extra Large</PactButton>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('states', () => {
    it('handles disabled state', () => {
      render(() => <PactButton disabled>Disabled</PactButton>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('handles loading state', () => {
      render(() => <PactButton loading loadingText="Loading...">Submit</PactButton>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toHaveAttribute('aria-label', 'Loading...');
    });

    it('shows loader when loading', () => {
      const { container } = render(() => <PactButton loading>Submit</PactButton>);
      const spinner = container.querySelector('span span'); // Nested span for spinner
      expect(spinner).toBeInTheDocument();
    });

    it('hides content when loading', () => {
      render(() => <PactButton loading>Submit</PactButton>);
      const button = screen.getByRole('button');
      const content = button.querySelector('[aria-hidden="true"]');
      expect(content).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('handles click events', () => {
      const handleClick = vi.fn();
      render(() => <PactButton onClick={handleClick}>Click me</PactButton>);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not trigger click when disabled', () => {
      const handleClick = vi.fn();
      render(() => <PactButton disabled onClick={handleClick}>Click me</PactButton>);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(handleClick).not.toHaveBeenCalled();
    });

    it('does not trigger click when loading', () => {
      const handleClick = vi.fn();
      render(() => <PactButton loading onClick={handleClick}>Click me</PactButton>);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('props', () => {
    it('applies fullWidth prop', () => {
      render(() => <PactButton fullWidth>Full Width</PactButton>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('passes through HTML button attributes', () => {
      render(() => (
        <PactButton
          type="submit"
          id="test-button"
          data-testid="custom-test-id"
        >
          Submit
        </PactButton>
      ));

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'submit');
      expect(button).toHaveAttribute('id', 'test-button');
      expect(button).toHaveAttribute('data-testid', 'custom-test-id');
    });

    it('applies aria-label', () => {
      render(() => <PactButton aria-label="Custom label">Button</PactButton>);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Custom label');
    });

    it('applies aria-describedby', () => {
      render(() => <PactButton aria-describedby="description">Button</PactButton>);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-describedby', 'description');
    });
  });
});