/**
 * Modal manager interface for UI components
 */
export interface IModalManager {
  /**
   * Show the modal
   */
  show(): void;
  
  /**
   * Hide the modal
   */
  hide(): void;
}