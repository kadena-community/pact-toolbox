import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { PactInput } from './input';

describe('PactInput', () => {
  it('renders basic input', () => {
    render(() => <PactInput placeholder="Enter text" />);
    const input = screen.getByPlaceholderText('Enter text');
    expect(input).toBeInTheDocument();
  });

  describe('variants', () => {
    it('renders default variant by default', () => {
      render(() => <PactInput placeholder="Default" />);
      expect(screen.getByPlaceholderText('Default')).toBeInTheDocument();
    });

    it('renders filled variant', () => {
      render(() => <PactInput variant="filled" placeholder="Filled" />);
      expect(screen.getByPlaceholderText('Filled')).toBeInTheDocument();
    });

    it('renders ghost variant', () => {
      render(() => <PactInput variant="ghost" placeholder="Ghost" />);
      expect(screen.getByPlaceholderText('Ghost')).toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it('renders medium size by default', () => {
      render(() => <PactInput placeholder="Medium" />);
      expect(screen.getByPlaceholderText('Medium')).toBeInTheDocument();
    });

    it('renders small size', () => {
      render(() => <PactInput size="sm" placeholder="Small" />);
      expect(screen.getByPlaceholderText('Small')).toBeInTheDocument();
    });

    it('renders large size', () => {
      render(() => <PactInput size="lg" placeholder="Large" />);
      expect(screen.getByPlaceholderText('Large')).toBeInTheDocument();
    });
  });

  describe('label and helper text', () => {
    it('renders with label', () => {
      render(() => <PactInput label="Email" placeholder="Enter email" />);
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter email')).toBeInTheDocument();
    });

    it('renders with helper text', () => {
      render(() => <PactInput helperText="This is helper text" />);
      expect(screen.getByText('This is helper text')).toBeInTheDocument();
    });

    it('renders with both label and helper text', () => {
      render(() => (
        <PactInput
          label="Username"
          helperText="Choose a unique username"
          placeholder="Enter username"
        />
      ));
      expect(screen.getByText('Username')).toBeInTheDocument();
      expect(screen.getByText('Choose a unique username')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message when error is a string', () => {
      render(() => <PactInput error="This field is required" />);
      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('shows helper text when error is boolean true', () => {
      render(() => (
        <PactInput
          error={true}
          helperText="Invalid input"
        />
      ));
      expect(screen.getByText('Invalid input')).toBeInTheDocument();
    });

    it('adds aria-invalid when there is an error', () => {
      render(() => <PactInput error="Error" placeholder="Test" />);
      const input = screen.getByPlaceholderText('Test');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('adds aria-describedby when there is an error message', () => {
      render(() => <PactInput error="Error message" placeholder="Test" />);
      const input = screen.getByPlaceholderText('Test');
      expect(input).toHaveAttribute('aria-describedby', 'input-error');
    });
  });

  describe('states', () => {
    it('handles disabled state', () => {
      render(() => <PactInput disabled placeholder="Disabled" />);
      const input = screen.getByPlaceholderText('Disabled');
      expect(input).toBeDisabled();
    });

    it('handles readonly state', () => {
      render(() => <PactInput readOnly value="Read only" />);
      const input = screen.getByDisplayValue('Read only');
      expect(input).toHaveAttribute('readOnly');
    });
  });

  describe('fullWidth prop', () => {
    it('applies fullWidth style', () => {
      const { container } = render(() => <PactInput fullWidth placeholder="Full width" />);
      const wrapper = container.firstChild;
      expect(wrapper).toBeInTheDocument();
    });
  });

  describe('icons', () => {
    it('renders with start icon', () => {
      render(() => (
        <PactInput
          startIcon={<span data-testid="start-icon">👤</span>}
          placeholder="With start icon"
        />
      ));
      expect(screen.getByTestId('start-icon')).toBeInTheDocument();
    });

    it('renders with end icon', () => {
      render(() => (
        <PactInput
          endIcon={<span data-testid="end-icon">🔍</span>}
          placeholder="With end icon"
        />
      ));
      expect(screen.getByTestId('end-icon')).toBeInTheDocument();
    });

    it('renders with both start and end icons', () => {
      render(() => (
        <PactInput
          startIcon={<span data-testid="start">👤</span>}
          endIcon={<span data-testid="end">🔍</span>}
          placeholder="With icons"
        />
      ));
      expect(screen.getByTestId('start')).toBeInTheDocument();
      expect(screen.getByTestId('end')).toBeInTheDocument();
    });
  });

  describe('events', () => {
    it('handles onChange event', () => {
      const handleChange = vi.fn();
      render(() => <PactInput onInput={handleChange} placeholder="Type here" />);

      const input = screen.getByPlaceholderText('Type here');
      fireEvent.input(input, { target: { value: 'test' } });

      expect(handleChange).toHaveBeenCalled();
    });

    it('handles onBlur event', () => {
      const handleBlur = vi.fn();
      render(() => <PactInput onBlur={handleBlur} placeholder="Type here" />);

      const input = screen.getByPlaceholderText('Type here');
      fireEvent.blur(input);

      expect(handleBlur).toHaveBeenCalled();
    });

    it('handles onFocus event', () => {
      const handleFocus = vi.fn();
      render(() => <PactInput onFocus={handleFocus} placeholder="Type here" />);

      const input = screen.getByPlaceholderText('Type here');
      fireEvent.focus(input);

      expect(handleFocus).toHaveBeenCalled();
    });
  });

  describe('HTML attributes', () => {
    it('passes through input HTML attributes', () => {
      render(() => (
        <PactInput
          id="test-input"
          name="email"
          type="email"
          required
          autocomplete="email"
          placeholder="Email"
        />
      ));

      const input = screen.getByPlaceholderText('Email');
      expect(input).toHaveAttribute('id', 'test-input');
      expect(input).toHaveAttribute('name', 'email');
      expect(input).toHaveAttribute('type', 'email');
      expect(input).toHaveAttribute('required');
      expect(input).toHaveAttribute('autocomplete', 'email');
    });

    it('handles value prop', () => {
      render(() => <PactInput value="Initial value" />);
      expect(screen.getByDisplayValue('Initial value')).toBeInTheDocument();
    });
  });
});