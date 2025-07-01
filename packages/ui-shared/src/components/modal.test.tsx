import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@solidjs/testing-library';
import { PactModal } from './modal';

describe('PactModal', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders when open is true', () => {
    render(() => (
      <PactModal open={true}>
        <p>Modal content</p>
      </PactModal>
    ));
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    render(() => (
      <PactModal open={false}>
        <p>Modal content</p>
      </PactModal>
    ));
    expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
  });

  describe('content sections', () => {
    it('renders with title', () => {
      render(() => (
        <PactModal open={true} title="Modal Title">
          <p>Body content</p>
        </PactModal>
      ));
      expect(screen.getByText('Modal Title')).toBeInTheDocument();
      expect(screen.getByText('Body content')).toBeInTheDocument();
    });

    it('renders with footer', () => {
      render(() => (
        <PactModal open={true} footer={<button>Save</button>}>
          <p>Body content</p>
        </PactModal>
      ));
      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Body content')).toBeInTheDocument();
    });

    it('renders with title and footer', () => {
      render(() => (
        <PactModal
          open={true}
          title="Title"
          footer={<button>Action</button>}
        >
          <p>Content</p>
        </PactModal>
      ));
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Content')).toBeInTheDocument();
      expect(screen.getByText('Action')).toBeInTheDocument();
    });
  });

  describe('close behavior', () => {
    it('calls onClose when close button is clicked', () => {
      const handleClose = vi.fn();
      render(() => (
        <PactModal open={true} title="Test" onClose={handleClose}>
          Content
        </PactModal>
      ));

      const closeButton = screen.getByLabelText('Close modal');
      fireEvent.click(closeButton);

      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when overlay is clicked by default', () => {
      const handleClose = vi.fn();
      render(() => (
        <PactModal open={true} onClose={handleClose}>
          <div data-testid="modal-content">Content</div>
        </PactModal>
      ));

      // The overlay is the parent of the modal dialog
      const dialog = screen.getByRole('dialog');
      const overlay = dialog.parentElement;

      if (overlay) {
        fireEvent.click(overlay);
      }

      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when overlay is clicked with closeOnOverlayClick=false', () => {
      const handleClose = vi.fn();
      const { container } = render(() => (
        <PactModal open={true} onClose={handleClose} closeOnOverlayClick={false}>
          Content
        </PactModal>
      ));

      const overlay = container.querySelector('div');
      if (overlay) {
        fireEvent.click(overlay);
      }

      expect(handleClose).not.toHaveBeenCalled();
    });

    it('does not close when modal content is clicked', () => {
      const handleClose = vi.fn();
      render(() => (
        <PactModal open={true} onClose={handleClose}>
          <div data-testid="content">Content</div>
        </PactModal>
      ));

      const content = screen.getByTestId('content');
      fireEvent.click(content);

      expect(handleClose).not.toHaveBeenCalled();
    });
  });

  describe('keyboard interactions', () => {
    it('closes on Escape key by default', () => {
      const handleClose = vi.fn();
      render(() => (
        <PactModal open={true} onClose={handleClose}>
          Content
        </PactModal>
      ));

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('does not close on Escape when closeOnEscape=false', () => {
      const handleClose = vi.fn();
      render(() => (
        <PactModal open={true} onClose={handleClose} closeOnEscape={false}>
          Content
        </PactModal>
      ));

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(handleClose).not.toHaveBeenCalled();
    });
  });

  describe('sizes', () => {
    it('renders with default size (md)', () => {
      render(() => (
        <PactModal open={true}>
          Default size
        </PactModal>
      ));
      expect(screen.getByText('Default size')).toBeInTheDocument();
    });

    it('renders with small size', () => {
      render(() => (
        <PactModal open={true} maxWidth="sm">
          Small modal
        </PactModal>
      ));
      expect(screen.getByText('Small modal')).toBeInTheDocument();
    });

    it('renders with large size', () => {
      render(() => (
        <PactModal open={true} maxWidth="lg">
          Large modal
        </PactModal>
      ));
      expect(screen.getByText('Large modal')).toBeInTheDocument();
    });

    it('renders with extra large size', () => {
      render(() => (
        <PactModal open={true} maxWidth="xl">
          XL modal
        </PactModal>
      ));
      expect(screen.getByText('XL modal')).toBeInTheDocument();
    });

    it('renders with full width', () => {
      render(() => (
        <PactModal open={true} maxWidth="full">
          Full width modal
        </PactModal>
      ));
      expect(screen.getByText('Full width modal')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(() => (
        <PactModal open={true} title="Accessible Modal">
          Content
        </PactModal>
      ));

      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(modal).toHaveAttribute('aria-labelledby', 'modal-title');
    });

    it('renders title with proper id', () => {
      render(() => (
        <PactModal open={true} title="Test Title">
          Content
        </PactModal>
      ));

      const title = screen.getByText('Test Title');
      expect(title).toHaveAttribute('id', 'modal-title');
    });
  });

  describe('portal rendering', () => {
    it('renders modal in a portal', () => {
      const { container } = render(() => (
        <PactModal open={true}>
          Portal content
        </PactModal>
      ));

      // Modal should not be in the container, but in document.body
      expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
      expect(document.body.querySelector('[role="dialog"]')).toBeInTheDocument();
    });
  });
});