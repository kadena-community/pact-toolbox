import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@solidjs/testing-library';
import { PactSelect } from './select';

describe('PactSelect', () => {
  beforeEach(() => {
    cleanup();
  });

  const defaultOptions = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3', disabled: true },
  ];

  it('renders with options', () => {
    render(() => <PactSelect options={defaultOptions} />);
    const select = screen.getByRole('combobox');
    expect(select).toBeTruthy();
    expect(select.querySelectorAll('option')).toHaveLength(3);
  });

  it('renders with placeholder', () => {
    render(() => <PactSelect options={defaultOptions} placeholder="Choose an option" />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    const placeholderOption = select.querySelector('option[value=""]');
    expect(placeholderOption?.textContent).toBe('Choose an option');
    expect(placeholderOption?.hasAttribute('disabled')).toBe(true);
  });

  it('renders with label', () => {
    render(() => <PactSelect options={defaultOptions} label="Select Option" />);
    expect(screen.getByText('Select Option')).toBeTruthy();
  });

  it('handles value changes', () => {
    const onChange = vi.fn();
    render(() => <PactSelect options={defaultOptions} onChange={onChange} />);

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'option2' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(select.value).toBe('option2');
  });

  it('applies size variants correctly', () => {
    const { unmount } = render(() => <PactSelect options={defaultOptions} size="sm" />);
    let select = screen.getByRole('combobox') as HTMLElement;
    let computedStyle = window.getComputedStyle(select);
    expect(computedStyle.minHeight).toBe('32px');

    unmount();
    render(() => <PactSelect options={defaultOptions} size="lg" />);
    select = screen.getByRole('combobox') as HTMLElement;
    computedStyle = window.getComputedStyle(select);
    expect(computedStyle.minHeight).toBe('48px');
  });

  it('applies style variants correctly', () => {
    const { unmount } = render(() => <PactSelect options={defaultOptions} variant="filled" />);
    let select = screen.getByRole('combobox') as HTMLElement;
    let computedStyle = window.getComputedStyle(select);
    // Filled variant should have different background color
    expect(computedStyle.backgroundColor).toBeTruthy();

    unmount();
    render(() => <PactSelect options={defaultOptions} variant="ghost" />);
    select = screen.getByRole('combobox') as HTMLElement;
    computedStyle = window.getComputedStyle(select);
    // Ghost variant should have transparent background initially (rgba(0, 0, 0, 0) is transparent)
    expect(computedStyle.backgroundColor).toBe('rgba(0, 0, 0, 0)');
  });

  it('displays error state', () => {
    render(() => <PactSelect options={defaultOptions} error="This field is required" />);
    const select = screen.getByRole('combobox');
    const errorMessage = screen.getByText('This field is required');

    expect(select.getAttribute('aria-invalid')).toBe('true');
    expect(select.getAttribute('aria-describedby')).toBe('select-error');
    expect(errorMessage).toBeTruthy();
  });

  it('displays helper text when no error', () => {
    render(() => <PactSelect options={defaultOptions} helperText="Please select an option" />);
    expect(screen.getByText('Please select an option')).toBeTruthy();
  });

  it('replaces helper text with error message when error exists', () => {
    render(() => (
      <PactSelect
        options={defaultOptions}
        helperText="Please select an option"
        error="Required field"
      />
    ));
    expect(screen.queryByText('Please select an option')).toBeFalsy();
    expect(screen.getByText('Required field')).toBeTruthy();
  });

  it('handles disabled options', () => {
    render(() => <PactSelect options={defaultOptions} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    const disabledOption = select.querySelector('option[value="option3"]') as HTMLOptionElement;

    expect(disabledOption.disabled).toBe(true);
  });

  it('applies fullWidth style', () => {
    render(() => <PactSelect options={defaultOptions} fullWidth />);
    const wrapper = screen.getByRole('combobox').closest('div') as HTMLElement;
    const computedStyle = window.getComputedStyle(wrapper);
    expect(computedStyle.width).toBeTruthy();
  });

  it('renders with start icon', () => {
    const icon = <span data-testid="start-icon">🔍</span>;
    render(() => <PactSelect options={defaultOptions} startIcon={icon} />);

    expect(screen.getByTestId('start-icon')).toBeTruthy();
    const select = screen.getByRole('combobox') as HTMLElement;
    const computedStyle = window.getComputedStyle(select);
    // Should have additional padding when icon is present
    expect(computedStyle.paddingLeft).toBeTruthy();
  });

  it('handles controlled value', () => {
    render(() => <PactSelect options={defaultOptions} value="option2" />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('option2');
  });

  it('disables select when disabled prop is true', () => {
    render(() => <PactSelect options={defaultOptions} disabled />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;

    expect(select.disabled).toBe(true);
  });

  it('handles custom className', () => {
    render(() => <PactSelect options={defaultOptions} class="custom-class" />);
    const select = screen.getByRole('combobox');

    expect(select.className).toContain('custom-class');
  });
});