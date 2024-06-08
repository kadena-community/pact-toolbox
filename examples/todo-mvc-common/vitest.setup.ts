import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import { mockEckoWallet } from "@pact-toolbox/wallet";

import "vitest-dom/extend-expect";

afterEach(() => {
  cleanup();
});

mockEckoWallet();
