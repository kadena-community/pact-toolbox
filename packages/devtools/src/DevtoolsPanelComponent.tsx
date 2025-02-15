import { makePersisted } from "@solid-primitives/storage";
import { createMemo } from "solid-js";

import { createStore } from "solid-js/store";
import { THEME_PREFERENCE } from "./constants";
import { PiPProvider, QueryDevtoolsContext, ThemeContext } from "./contexts";
import type { DevtoolsComponentType } from "./Devtools";
import { ContentView, ParentPanel } from "./Devtools";
import { getPreferredColorScheme } from "./utils";

const DevtoolsPanelComponent: DevtoolsComponentType = (props) => {
  const [localStore, setLocalStore] = makePersisted(createStore({
    theme_preference: THEME_PREFERENCE,
  }), {
    name: 'PactToolboxDevtools',
  });

  const colorScheme = getPreferredColorScheme();

  const theme = createMemo(() => {
    const preference = (localStore.theme_preference || THEME_PREFERENCE) as "system" | "dark" | "light";
    if (preference !== "system") return preference;
    return colorScheme();
  });

  return (
    <QueryDevtoolsContext.Provider value={props}>
      <PiPProvider disabled localStore={localStore} setLocalStore={setLocalStore}>
        <ThemeContext.Provider value={theme}>
          <ParentPanel>
            <ContentView
              localStore={localStore}
              setLocalStore={setLocalStore}
              onClose={props.onClose}
              showPanelViewOnly
            />
          </ParentPanel>
        </ThemeContext.Provider>
      </PiPProvider>
    </QueryDevtoolsContext.Provider>
  );
};

export default DevtoolsPanelComponent;
