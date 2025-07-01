import { render } from 'solid-js/web';
import { createSignal } from 'solid-js';
import { ThemeProvider, initializeGlobalStyles } from './index';
import {
  PactButton,
  PactIconButton,
  PactCard,
  PactSpinner,
  PactBadge,
  PactModal,
  PactInput,
  PactTextarea,
  PactCheckbox,
  // PactRadio,
  PactRadioGroup,
  PactSwitch,
  PactSelect,
  PactAlert,
  PactProgress,
  PactDivider,
  PactTooltip,
  PactAvatar,
  PactTabs,
  PactTabList,
  PactTab,
  PactTabPanel,
  PactAccordion,
  PactAccordionItem,
  PactAccordionTrigger,
  PactAccordionContent,
  PactDrawer,
  PactJsonTree,
  PactDropdown,
  PactDropdownItem,
  PactDropdownDivider,
  PactPopover
} from './components';

// Initialize global styles
initializeGlobalStyles();

function App() {
  const [theme, setTheme] = createSignal<'light' | 'dark' | 'auto'>('light');

  return (
    <ThemeProvider theme={theme()}>
      <Demo theme={theme} setTheme={setTheme} />
    </ThemeProvider>
  );
}

function Demo(props: { theme: () => 'light' | 'dark' | 'auto', setTheme: (theme: 'light' | 'dark' | 'auto') => void }) {
  const [modalOpen, setModalOpen] = createSignal(false);
  const [drawerOpen, setDrawerOpen] = createSignal(false);
  const [checkboxChecked, setCheckboxChecked] = createSignal(false);
  const [switchChecked, setSwitchChecked] = createSignal(false);
  const [selectedRadio, setSelectedRadio] = createSignal('option1');
  const [selectValue, setSelectValue] = createSignal('');

  // Sample JSON data for tree viewer
  const sampleJsonData = {
    user: {
      id: 12345,
      name: "John Doe",
      email: "john.doe@example.com",
      isActive: true,
      preferences: {
        theme: "dark",
        notifications: {
          email: true,
          push: false,
          sms: null
        }
      },
      tags: ["developer", "typescript", "react"],
      metadata: null
    },
    timestamp: "2024-01-15T10:30:00Z",
    count: 42
  };
  const [inputValue, setInputValue] = createSignal('');
  const [textareaValue, setTextareaValue] = createSignal('');
  const [activeTab, setActiveTab] = createSignal(0);

  return (
    <div style={{
      padding: '2rem',
      'max-width': '1400px',
      margin: '0 auto',
      'background-color': 'var(--pact-color-bg-primary)',
      'min-height': '100vh'
    }}>
      {/* Header with theme toggle */}
      <div style={{
        display: 'flex',
        'justify-content': 'space-between',
        'align-items': 'center',
        'margin-bottom': '3rem',
        'padding-bottom': '2rem',
        'border-bottom': '1px solid var(--pact-color-border-primary)'
      }}>
        <div>
          <h1 style={{
            'font-size': '2.5rem',
            'font-weight': '700',
            'margin-bottom': '0.5rem',
            'background': 'linear-gradient(135deg, var(--pact-color-primary) 0%, var(--pact-color-secondary) 100%)',
            '-webkit-background-clip': 'text',
            '-webkit-text-fill-color': 'transparent',
            'background-clip': 'text'
          }}>
            Pact Toolbox UI Components
          </h1>
          <p style={{ color: 'var(--pact-color-text-secondary)' }}>
            Modern, accessible UI components for developer tools
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <PactButton
            variant={props.theme() === 'light' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => props.setTheme('light')}
          >
            ☀️ Light
          </PactButton>
          <PactButton
            variant={props.theme() === 'dark' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => props.setTheme('dark')}
          >
            🌙 Dark
          </PactButton>
        </div>
      </div>

      <div style={{
        display: 'flex',
        'flex-direction': 'column',
        gap: '4rem'
      }}>
        {/* Buttons Section */}
        <section>
          <h2 style={{ 'margin-bottom': '1.5rem', color: 'var(--pact-color-text-primary)' }}>Buttons</h2>
          <PactCard padding="lg">
            <div style={{ display: 'flex', 'flex-direction': 'column', gap: '1.5rem' }}>
              <div>
                <h3 style={{ 'font-size': '0.875rem', 'margin-bottom': '1rem', color: 'var(--pact-color-text-secondary)' }}>Variants</h3>
                <div style={{ display: 'flex', gap: '1rem', 'flex-wrap': 'wrap' }}>
                  <PactButton variant="primary">Primary</PactButton>
                  <PactButton variant="secondary">Secondary</PactButton>
                  <PactButton variant="ghost">Ghost</PactButton>
                  <PactButton variant="danger">Danger</PactButton>
                  <PactButton variant="outline">Outline</PactButton>
                  <PactButton variant="link">Link</PactButton>
                </div>
              </div>

              <PactDivider />

              <div>
                <h3 style={{ 'font-size': '0.875rem', 'margin-bottom': '1rem', color: 'var(--pact-color-text-secondary)' }}>Sizes</h3>
                <div style={{ display: 'flex', gap: '1rem', 'flex-wrap': 'wrap', 'align-items': 'center' }}>
                  <PactButton size="xs">Extra Small</PactButton>
                  <PactButton size="sm">Small</PactButton>
                  <PactButton size="md">Medium</PactButton>
                  <PactButton size="lg">Large</PactButton>
                  <PactButton size="xl">Extra Large</PactButton>
                </div>
              </div>

              <PactDivider />

              <div>
                <h3 style={{ 'font-size': '0.875rem', 'margin-bottom': '1rem', color: 'var(--pact-color-text-secondary)' }}>States</h3>
                <div style={{ display: 'flex', gap: '1rem', 'flex-wrap': 'wrap' }}>
                  <PactButton loading>Loading</PactButton>
                  <PactButton disabled>Disabled</PactButton>
                  <PactButton fullWidth>Full Width Button</PactButton>
                </div>
              </div>

              <PactDivider />

              <div>
                <h3 style={{ 'font-size': '0.875rem', 'margin-bottom': '1rem', color: 'var(--pact-color-text-secondary)' }}>With Icons</h3>
                <div style={{ display: 'flex', gap: '1rem', 'flex-wrap': 'wrap', 'align-items': 'center' }}>
                  <PactButton
                    startIcon={
                      <svg fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                      </svg>
                    }
                  >
                    Add Item
                  </PactButton>
                  <PactButton
                    variant="secondary"
                    endIcon={
                      <svg fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                      </svg>
                    }
                  >
                    Next
                  </PactButton>
                  <PactButton
                    variant="outline"
                    size="sm"
                    startIcon={
                      <svg fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
                      </svg>
                    }
                  >
                    Menu
                  </PactButton>
                  <PactButton
                    variant="ghost"
                    size="lg"
                    startIcon={
                      <svg fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                    }
                    endIcon={
                      <svg fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6m4-3h6v6m0 0l-8 8"/>
                      </svg>
                    }
                  >
                    Complete & Open
                  </PactButton>
                </div>
              </div>
            </div>
          </PactCard>
        </section>

        {/* Icon Buttons Section */}
        <section>
          <h2 style={{ 'margin-bottom': '1.5rem', color: 'var(--pact-color-text-primary)' }}>Icon Buttons</h2>
          <PactCard padding="lg">
            <div style={{ display: 'grid', gap: '2rem' }}>
              {/* Variants */}
              <div>
                <h3 style={{ 'font-size': '0.875rem', 'margin-bottom': '1rem', color: 'var(--pact-color-text-secondary)' }}>Variants</h3>
                <div style={{ display: 'flex', gap: '1rem', 'flex-wrap': 'wrap', 'align-items': 'center' }}>
                  <PactIconButton variant="primary" aria-label="Settings">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M12 1v6m0 10v6m11-7h-6m-10 0H1m21-7a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  </PactIconButton>
                  <PactIconButton variant="secondary" aria-label="Edit">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </PactIconButton>
                  <PactIconButton variant="ghost" aria-label="More options">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="1"/>
                      <circle cx="12" cy="5" r="1"/>
                      <circle cx="12" cy="19" r="1"/>
                    </svg>
                  </PactIconButton>
                  <PactIconButton variant="outline" aria-label="Search">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="11" cy="11" r="8"/>
                      <path d="M21 21l-4.35-4.35"/>
                    </svg>
                  </PactIconButton>
                  <PactIconButton variant="danger" aria-label="Delete">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3,6 5,6 21,6"/>
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                      <line x1="10" y1="11" x2="10" y2="17"/>
                      <line x1="14" y1="11" x2="14" y2="17"/>
                    </svg>
                  </PactIconButton>
                  <PactIconButton variant="link" aria-label="External link">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                      <polyline points="15,3 21,3 21,9"/>
                      <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </PactIconButton>
                </div>
              </div>

              <PactDivider />

              {/* Sizes */}
              <div>
                <h3 style={{ 'font-size': '0.875rem', 'margin-bottom': '1rem', color: 'var(--pact-color-text-secondary)' }}>Sizes</h3>
                <div style={{ display: 'flex', gap: '1rem', 'flex-wrap': 'wrap', 'align-items': 'center' }}>
                  <PactIconButton size="xs" aria-label="Heart">
                    <svg fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                  </PactIconButton>
                  <PactIconButton size="sm" aria-label="Heart">
                    <svg fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                  </PactIconButton>
                  <PactIconButton size="md" aria-label="Heart">
                    <svg fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                  </PactIconButton>
                  <PactIconButton size="lg" aria-label="Heart">
                    <svg fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                  </PactIconButton>
                  <PactIconButton size="xl" aria-label="Heart">
                    <svg fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                  </PactIconButton>
                </div>
              </div>

              <PactDivider />

              {/* States */}
              <div>
                <h3 style={{ 'font-size': '0.875rem', 'margin-bottom': '1rem', color: 'var(--pact-color-text-secondary)' }}>States</h3>
                <div style={{ display: 'flex', gap: '1rem', 'flex-wrap': 'wrap', 'align-items': 'center' }}>
                  <PactIconButton loading aria-label="Loading">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c.39 0 .78.02 1.17.06"/>
                    </svg>
                  </PactIconButton>
                  <PactIconButton disabled aria-label="Disabled">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </PactIconButton>
                </div>
              </div>
            </div>
          </PactCard>
        </section>

        {/* Forms Section */}
        <section>
          <h2 style={{ 'margin-bottom': '1.5rem', color: 'var(--pact-color-text-primary)' }}>Form Controls</h2>
          <PactCard padding="lg">
            <div style={{ display: 'grid', gap: '2rem' }}>
              {/* Input Fields */}
              <div>
                <h3 style={{ 'font-size': '0.875rem', 'margin-bottom': '1rem', color: 'var(--pact-color-text-secondary)' }}>Input Fields</h3>
                <div style={{ display: 'grid', gap: '1.5rem' }}>
                  <PactInput
                    placeholder="Default input"
                    label="Default Input"
                    value={inputValue()}
                    onInput={(e) => setInputValue(e.currentTarget.value)}
                  />
                  <PactInput
                    variant="filled"
                    placeholder="Filled variant"
                    label="Filled Variant"
                    helperText="This is a helpful hint"
                  />
                  <PactInput
                    variant="ghost"
                    placeholder="Ghost variant"
                    label="Ghost Variant"
                  />
                  <PactInput
                    placeholder="Input with error"
                    label="Error State"
                    error="This field is required"
                  />
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <PactInput size="sm" placeholder="Small" />
                    <PactInput size="md" placeholder="Medium" />
                    <PactInput size="lg" placeholder="Large" />
                  </div>
                </div>
              </div>

              <PactDivider />

              {/* Textarea */}
              <div>
                <h3 style={{ 'font-size': '0.875rem', 'margin-bottom': '1rem', color: 'var(--pact-color-text-secondary)' }}>Textarea</h3>
                <PactTextarea
                  placeholder="Enter your message here..."
                  label="Message"
                  rows={4}
                  value={textareaValue()}
                  onInput={(e) => setTextareaValue(e.currentTarget.value)}
                />
              </div>

              <PactDivider />

              {/* Select */}
              <div>
                <h3 style={{ 'font-size': '0.875rem', 'margin-bottom': '1rem', color: 'var(--pact-color-text-secondary)' }}>Select</h3>
                <PactSelect
                  label="Choose an option"
                  value={selectValue()}
                  onChange={(e) => setSelectValue(e.currentTarget.value)}
                  options={[
                    { value: '', label: 'Select an option' },
                    { value: 'option1', label: 'Option 1' },
                    { value: 'option2', label: 'Option 2' },
                    { value: 'option3', label: 'Option 3' }
                  ]}
                  placeholder="Select an option"
                />
              </div>

              <PactDivider />

              {/* Checkboxes, Radios, Switches */}
              <div>
                <h3 style={{ 'font-size': '0.875rem', 'margin-bottom': '1rem', color: 'var(--pact-color-text-secondary)' }}>Toggles</h3>
                <div style={{ display: 'flex', gap: '2rem', 'flex-wrap': 'wrap' }}>
                  <PactCheckbox
                    checked={checkboxChecked()}
                    onChange={(e) => setCheckboxChecked(e.currentTarget.checked)}
                    label="Checkbox"
                  />
                  <PactSwitch
                    checked={switchChecked()}
                    onChange={(e) => setSwitchChecked(e.currentTarget.checked)}
                    label="Switch"
                  />
                </div>
                <div style={{ 'margin-top': '1rem' }}>
                  <PactRadioGroup
                    name="demo-radio"
                    value={selectedRadio()}
                    onChange={setSelectedRadio}
                    options={[
                      { value: "option1", label: "Radio Option 1" },
                      { value: "option2", label: "Radio Option 2" },
                      { value: "option3", label: "Radio Option 3" }
                    ]}
                  />
                </div>
              </div>
            </div>
          </PactCard>
        </section>

        {/* Feedback Section */}
        <section>
          <h2 style={{ 'margin-bottom': '1.5rem', color: 'var(--pact-color-text-primary)' }}>Feedback</h2>
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            {/* Alerts */}
            <PactCard padding="lg">
              <h3 style={{ 'font-size': '0.875rem', 'margin-bottom': '1rem', color: 'var(--pact-color-text-secondary)' }}>Alerts</h3>
              <div style={{ display: 'flex', 'flex-direction': 'column', gap: '1rem' }}>
                <PactAlert variant="primary" title="Primary Alert">
                  This is a primary alert message.
                </PactAlert>
                <PactAlert variant="secondary" title="Secondary Alert">
                  This is a secondary alert message.
                </PactAlert>
                <PactAlert variant="info" title="Info Alert">
                  This is an informational message.
                </PactAlert>
                <PactAlert variant="success" title="Success!">
                  Your operation completed successfully.
                </PactAlert>
                <PactAlert variant="warning" title="Warning">
                  Please review this important information.
                </PactAlert>
                <PactAlert variant="error" title="Error">
                  Something went wrong. Please try again.
                </PactAlert>
                <PactAlert
                  variant="warning"
                  title="Dismissible Alert"
                  dismissible={true}
                  onDismiss={() => console.log('Alert dismissed')}
                >
                  This alert can be dismissed by clicking the X button.
                </PactAlert>
                <PactAlert
                  variant="info"
                  title="Alert with Actions"
                  actions={
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <PactButton size="sm" variant="outline">Learn More</PactButton>
                      <PactButton size="sm" variant="primary">Take Action</PactButton>
                    </div>
                  }
                >
                  This alert includes action buttons for user interaction.
                </PactAlert>
              </div>
            </PactCard>

            {/* Progress */}
            <PactCard padding="lg">
              <h3 style={{ 'font-size': '0.875rem', 'margin-bottom': '1rem', color: 'var(--pact-color-text-secondary)' }}>Progress</h3>
              <div style={{ display: 'flex', 'flex-direction': 'column', gap: '1.5rem' }}>
                <div>
                  <h4 style={{ 'font-size': '0.75rem', 'margin-bottom': '0.5rem', color: 'var(--pact-color-text-tertiary)', 'text-transform': 'uppercase', 'letter-spacing': '0.05em' }}>Variants</h4>
                  <div style={{ display: 'flex', 'flex-direction': 'column', gap: '0.75rem' }}>
                    <PactProgress value={25} variant="primary" />
                    <PactProgress value={40} variant="secondary" />
                    <PactProgress value={60} variant="success" />
                    <PactProgress value={75} variant="warning" />
                    <PactProgress value={90} variant="error" />
                    <PactProgress value={100} variant="info" />
                  </div>
                </div>
                <div>
                  <h4 style={{ 'font-size': '0.75rem', 'margin-bottom': '0.5rem', color: 'var(--pact-color-text-tertiary)', 'text-transform': 'uppercase', 'letter-spacing': '0.05em' }}>Sizes</h4>
                  <div style={{ display: 'flex', 'flex-direction': 'column', gap: '0.75rem' }}>
                    <PactProgress value={65} size="xs" />
                    <PactProgress value={65} size="sm" />
                    <PactProgress value={65} size="md" />
                    <PactProgress value={65} size="lg" />
                    <PactProgress value={65} size="xl" />
                  </div>
                </div>
              </div>
            </PactCard>

            {/* Spinners */}
            <PactCard padding="lg">
              <h3 style={{ 'font-size': '0.875rem', 'margin-bottom': '1rem', color: 'var(--pact-color-text-secondary)' }}>Spinners</h3>
              <div style={{ display: 'flex', 'flex-direction': 'column', gap: '1.5rem' }}>
                <div>
                  <h4 style={{ 'font-size': '0.75rem', 'margin-bottom': '0.5rem', color: 'var(--pact-color-text-tertiary)', 'text-transform': 'uppercase', 'letter-spacing': '0.05em' }}>Variants</h4>
                  <div style={{ display: 'flex', gap: '1rem', 'align-items': 'center', 'flex-wrap': 'wrap' }}>
                    <PactSpinner variant="primary" />
                    <PactSpinner variant="secondary" />
                    <PactSpinner variant="success" />
                    <PactSpinner variant="warning" />
                    <PactSpinner variant="error" />
                    <PactSpinner variant="info" />
                  </div>
                </div>
                <div>
                  <h4 style={{ 'font-size': '0.75rem', 'margin-bottom': '0.5rem', color: 'var(--pact-color-text-tertiary)', 'text-transform': 'uppercase', 'letter-spacing': '0.05em' }}>Sizes</h4>
                  <div style={{ display: 'flex', gap: '1rem', 'align-items': 'center', 'flex-wrap': 'wrap' }}>
                    <PactSpinner size="xs" />
                    <PactSpinner size="sm" />
                    <PactSpinner size="md" />
                    <PactSpinner size="lg" />
                    <PactSpinner size="xl" />
                  </div>
                </div>
              </div>
            </PactCard>
          </div>
        </section>

        {/* Data Display Section */}
        <section>
          <h2 style={{ 'margin-bottom': '1.5rem', color: 'var(--pact-color-text-primary)' }}>Data Display</h2>
          <div style={{ display: 'grid', gap: '1.5rem', 'grid-template-columns': 'repeat(auto-fit, minmax(300px, 1fr))' }}>
            {/* Badges */}
            <PactCard padding="lg">
              <h3 style={{ 'font-size': '0.875rem', 'margin-bottom': '1rem', color: 'var(--pact-color-text-secondary)' }}>Badges</h3>
              <div style={{ display: 'flex', gap: '1rem', 'flex-wrap': 'wrap' }}>
                <PactBadge variant="default">Default</PactBadge>
                <PactBadge variant="primary">Primary</PactBadge>
                <PactBadge variant="success">Success</PactBadge>
                <PactBadge variant="error">Error</PactBadge>
                <PactBadge variant="warning">Warning</PactBadge>
                <PactBadge variant="info">Info</PactBadge>
              </div>
              <div style={{ display: 'flex', gap: '1rem', 'margin-top': '1rem' }}>
                <PactBadge size="sm">Small</PactBadge>
                <PactBadge size="md">Medium</PactBadge>
                <PactBadge size="lg">Large</PactBadge>
              </div>
            </PactCard>

            {/* Avatar */}
            <PactCard padding="lg">
              <h3 style={{ 'font-size': '0.875rem', 'margin-bottom': '1rem', color: 'var(--pact-color-text-secondary)' }}>Avatars</h3>
              <div style={{ display: 'flex', gap: '1rem', 'align-items': 'center' }}>
                <PactAvatar size="sm" name="John Doe" />
                <PactAvatar size="md" name="Jane Smith" />
                <PactAvatar size="lg" name="Alex Johnson" />
                <PactAvatar size="xl" src="https://via.placeholder.com/100" />
              </div>
            </PactCard>

            {/* Tooltips */}
            <PactCard padding="lg">
              <h3 style={{ 'font-size': '0.875rem', 'margin-bottom': '1rem', color: 'var(--pact-color-text-secondary)' }}>Tooltips</h3>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <PactTooltip target={<PactButton size="sm">Hover me</PactButton>}>
                  This is a tooltip
                </PactTooltip>
                <PactTooltip target={<PactBadge variant="info">Info Badge</PactBadge>} position="bottom">
                  Another helpful hint
                </PactTooltip>
              </div>
            </PactCard>
          </div>
        </section>

        {/* Layout Section */}
        <section>
          <h2 style={{ 'margin-bottom': '1.5rem', color: 'var(--pact-color-text-primary)' }}>Layout</h2>

          {/* Cards */}
          <div style={{ 'margin-bottom': '2rem' }}>
            <h3 style={{ 'font-size': '0.875rem', 'margin-bottom': '1rem', color: 'var(--pact-color-text-secondary)' }}>Cards</h3>
            <div style={{ display: 'grid', 'grid-template-columns': 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
              <PactCard>
                <h4>Simple Card</h4>
                <p style={{ color: 'var(--pact-color-text-secondary)' }}>
                  This is a basic card with default padding.
                </p>
              </PactCard>

              <PactCard hoverable>
                <h4>Hoverable Card</h4>
                <p style={{ color: 'var(--pact-color-text-secondary)' }}>
                  This card has hover effects.
                </p>
              </PactCard>

              <PactCard
                header={<h4 style={{ margin: 0 }}>Card with Header</h4>}
                footer={
                  <div style={{ display: 'flex', gap: '0.5rem', 'justify-content': 'flex-end' }}>
                    <PactButton variant="ghost" size="sm">Cancel</PactButton>
                    <PactButton variant="primary" size="sm">Action</PactButton>
                  </div>
                }
              >
                <p style={{ color: 'var(--pact-color-text-secondary)' }}>
                  Card content goes here.
                </p>
              </PactCard>
            </div>
          </div>

          {/* Tabs */}
          <PactCard padding="lg">
            <h3 style={{ 'font-size': '0.875rem', 'margin-bottom': '1rem', color: 'var(--pact-color-text-secondary)' }}>Tabs</h3>
            <PactTabs value={activeTab().toString()} onChange={(val) => setActiveTab(parseInt(val))}>
              <PactTabList>
                <PactTab value="0">Tab 1</PactTab>
                <PactTab value="1">Tab 2</PactTab>
                <PactTab value="2">Tab 3</PactTab>
              </PactTabList>
              <PactTabPanel value="0">
                <p style={{ padding: '1rem 0' }}>Content for Tab 1</p>
              </PactTabPanel>
              <PactTabPanel value="1">
                <p style={{ padding: '1rem 0' }}>Content for Tab 2</p>
              </PactTabPanel>
              <PactTabPanel value="2">
                <p style={{ padding: '1rem 0' }}>Content for Tab 3</p>
              </PactTabPanel>
            </PactTabs>
          </PactCard>

          {/* Accordion */}
          <PactCard padding="lg" style={{ 'margin-top': '1.5rem' }}>
            <h3 style={{ 'font-size': '0.875rem', 'margin-bottom': '1rem', color: 'var(--pact-color-text-secondary)' }}>Accordion</h3>
            <PactAccordion type="multiple" defaultValue={['item1']}>
              <PactAccordionItem value="item1">
                <PactAccordionTrigger>Accordion Item 1</PactAccordionTrigger>
                <PactAccordionContent>
                  <p>This is the content for accordion item 1.</p>
                </PactAccordionContent>
              </PactAccordionItem>
              <PactAccordionItem value="item2">
                <PactAccordionTrigger>Accordion Item 2</PactAccordionTrigger>
                <PactAccordionContent>
                  <p>This is the content for accordion item 2.</p>
                </PactAccordionContent>
              </PactAccordionItem>
              <PactAccordionItem value="item3">
                <PactAccordionTrigger>Accordion Item 3</PactAccordionTrigger>
                <PactAccordionContent>
                  <p>This is the content for accordion item 3.</p>
                </PactAccordionContent>
              </PactAccordionItem>
            </PactAccordion>
          </PactCard>
        </section>

        {/* Modal */}
        <section>
          <h2 style={{ 'margin-bottom': '1.5rem', color: 'var(--pact-color-text-primary)' }}>Modal</h2>
          <PactCard padding="lg">
            <PactButton variant="primary" onClick={() => setModalOpen(true)}>
              Open Modal
            </PactButton>
            <PactModal
              open={modalOpen()}
              onClose={() => setModalOpen(false)}
              title="Example Modal"
              footer={
                <>
                  <PactButton variant="ghost" onClick={() => setModalOpen(false)}>
                    Cancel
                  </PactButton>
                  <PactButton variant="primary" onClick={() => setModalOpen(false)}>
                    Confirm
                  </PactButton>
                </>
              }
            >
              <p>This is a modal dialog with a modern design.</p>
              <p style={{ 'margin-top': '1rem', color: 'var(--pact-color-text-secondary)' }}>
                Click outside or press Escape to close.
              </p>
            </PactModal>
          </PactCard>
        </section>

        {/* Drawer */}
        <section>
          <h2 style={{ 'margin-bottom': '1.5rem', color: 'var(--pact-color-text-primary)' }}>Drawer</h2>
          <PactCard padding="lg">
            <div style={{ display: 'flex', gap: '1rem', 'flex-wrap': 'wrap' }}>
              <PactButton variant="primary" onClick={() => setDrawerOpen(true)}>
                Open Right Drawer
              </PactButton>
            </div>
            <PactDrawer
              open={drawerOpen()}
              onClose={() => setDrawerOpen(false)}
              title="Example Drawer"
              position="right"
              size="md"
              footer={
                <>
                  <PactButton variant="ghost" onClick={() => setDrawerOpen(false)}>
                    Cancel
                  </PactButton>
                  <PactButton variant="primary" onClick={() => setDrawerOpen(false)}>
                    Save
                  </PactButton>
                </>
              }
            >
              <div style={{ display: 'flex', 'flex-direction': 'column', gap: '1rem' }}>
                <p>This is a drawer component that slides in from the side.</p>
                <PactInput label="Name" placeholder="Enter your name" />
                <PactTextarea label="Description" placeholder="Enter description..." rows={4} />
                <PactCheckbox label="Enable notifications" />
                <PactSwitch label="Public profile" />
              </div>
            </PactDrawer>
          </PactCard>
        </section>

        {/* Dropdown */}
        <section>
          <h2 style={{ 'margin-bottom': '1.5rem', color: 'var(--pact-color-text-primary)' }}>Dropdown</h2>
          <PactCard padding="lg">
            <div style={{ display: 'flex', gap: '1rem', 'flex-wrap': 'wrap', 'align-items': 'start' }}>
              <PactDropdown
                target={
                  <PactButton variant="secondary">
                    Account Menu ▼
                  </PactButton>
                }
                placement="bottom-start"
              >
                <PactDropdownItem onClick={() => console.log('Profile clicked')}>
                  👤 Profile
                </PactDropdownItem>
                <PactDropdownItem onClick={() => console.log('Settings clicked')}>
                  ⚙️ Settings
                </PactDropdownItem>
                <PactDropdownDivider />
                <PactDropdownItem onClick={() => console.log('Help clicked')}>
                  ❓ Help & Support
                </PactDropdownItem>
                <PactDropdownItem danger onClick={() => console.log('Logout clicked')}>
                  🚪 Logout
                </PactDropdownItem>
              </PactDropdown>

              <PactDropdown
                target={
                  <PactIconButton variant="outline" aria-label="Actions">
                    <svg fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                    </svg>
                  </PactIconButton>
                }
                placement="bottom-end"
              >
                <PactDropdownItem onClick={() => console.log('New file')}>
                  📄 New File
                </PactDropdownItem>
                <PactDropdownItem onClick={() => console.log('New folder')}>
                  📁 New Folder
                </PactDropdownItem>
                <PactDropdownDivider />
                <PactDropdownItem onClick={() => console.log('Import')}>
                  📥 Import
                </PactDropdownItem>
                <PactDropdownItem onClick={() => console.log('Export')}>
                  📤 Export
                </PactDropdownItem>
              </PactDropdown>

              <PactDropdown
                target={
                  <PactButton variant="ghost">
                    Right Click Menu ▲
                  </PactButton>
                }
                placement="top-start"
              >
                <PactDropdownItem onClick={() => console.log('Copy')}>
                  📋 Copy
                </PactDropdownItem>
                <PactDropdownItem onClick={() => console.log('Cut')}>
                  ✂️ Cut
                </PactDropdownItem>
                <PactDropdownItem onClick={() => console.log('Paste')}>
                  📋 Paste
                </PactDropdownItem>
                <PactDropdownDivider />
                <PactDropdownItem danger onClick={() => console.log('Delete')}>
                  🗑️ Delete
                </PactDropdownItem>
              </PactDropdown>
            </div>
          </PactCard>
        </section>

        {/* Popover */}
        <section>
          <h2 style={{ 'margin-bottom': '1.5rem', color: 'var(--pact-color-text-primary)' }}>Popover</h2>
          <PactCard padding="lg">
            <div style={{ display: 'flex', gap: '1rem', 'flex-wrap': 'wrap', 'align-items': 'start' }}>
              <PactPopover
                target={
                  <PactButton variant="primary">
                    Click for Info
                  </PactButton>
                }
                placement="bottom"
                trigger="click"
              >
                <div style={{ padding: '0.5rem 0' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', 'font-size': '0.875rem', 'font-weight': '600' }}>
                    Quick Info
                  </h4>
                  <p style={{ margin: '0', 'font-size': '0.75rem', 'line-height': '1.4' }}>
                    This is a click-triggered popover with detailed information.
                    You can include rich content here including text, buttons, and other components.
                  </p>
                  <div style={{ 'margin-top': '0.75rem', display: 'flex', gap: '0.5rem' }}>
                    <PactButton size="xs" variant="primary">Learn More</PactButton>
                    <PactButton size="xs" variant="ghost">Dismiss</PactButton>
                  </div>
                </div>
              </PactPopover>

              <PactPopover
                target={<PactBadge variant="info">Hover Me</PactBadge>}
                placement="top"
                trigger="hover"
                showArrow={true}
              >
                <div style={{ padding: '0.25rem 0' }}>
                  <p style={{ margin: '0', 'font-size': '0.75rem' }}>
                    Hover over me to see this popover! It will disappear when you move your mouse away.
                  </p>
                </div>
              </PactPopover>

              <PactPopover
                target={
                  <PactButton variant="outline">
                    Focus for Profile
                  </PactButton>
                }
                placement="right"
                trigger="focus"
              >
                <div style={{ padding: '0.5rem 0' }}>
                  <div style={{ display: 'flex', 'align-items': 'center', gap: '0.5rem', 'margin-bottom': '0.5rem' }}>
                    <PactAvatar name="John Doe" size="sm" />
                    <div>
                      <div style={{ 'font-size': '0.75rem', 'font-weight': '600' }}>John Doe</div>
                      <div style={{ 'font-size': '0.6875rem', color: 'var(--pact-color-text-secondary)' }}>Frontend Developer</div>
                    </div>
                  </div>
                  <p style={{ margin: '0', 'font-size': '0.6875rem', 'line-height': '1.4' }}>
                    Passionate about creating beautiful and functional user interfaces.
                  </p>
                </div>
              </PactPopover>
            </div>
          </PactCard>
        </section>

        {/* JSON Tree Viewer */}
        <section>
          <h2 style={{ 'margin-bottom': '1.5rem', color: 'var(--pact-color-text-primary)' }}>JSON Tree Viewer</h2>
          <PactCard padding="lg">
            <h3 style={{ 'font-size': '0.875rem', 'margin-bottom': '1rem', color: 'var(--pact-color-text-secondary)' }}>Interactive JSON Explorer</h3>
            <PactJsonTree
              data={sampleJsonData}
              expandDepth={2}
              showDataTypes={true}
              showObjectSize={true}
              sortKeys={false}
              rootName="response"
            />
          </PactCard>
        </section>
      </div>
    </div>
  );
}

render(() => <App />, document.getElementById('app')!);