import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getRandomNetworkPorts } from "./port";

describe("getRandomNetworkPorts", () => {
  it("should return valid random network ports", async () => {
    const ports = await getRandomNetworkPorts();
    assert.ok(ports.proxy > 0 && ports.proxy <= 65535, "Proxy port should be valid");
    assert.ok(ports.service > 0 && ports.service <= 65535, "Service port should be valid");
    assert.ok(ports.onDemand > 0 && ports.onDemand <= 65535, "On-demand port should be valid");
    assert.ok(ports.stratum > 0 && ports.stratum <= 65535, "Stratum port should be valid");
    assert.ok(ports.p2p > 0 && ports.p2p <= 65535, "P2P port should be valid");
  });

  it("should allow configurable gaps between ports", async () => {
    const startGap = 20;
    const endGap = 50;
    const ports = await getRandomNetworkPorts("127.0.0.1", startGap, endGap);

    assert.ok(
      ports.service - ports.proxy >= startGap,
      "Service port should have a gap greater than or equal to startGap from proxy",
    );
    assert.ok(
      ports.service - ports.proxy <= endGap,
      "Service port should have a gap less than or equal to endGap from proxy",
    );
    assert.ok(
      ports.onDemand - ports.service >= startGap,
      "On-demand port should have a gap greater than or equal to startGap from service",
    );
  });

  it("should throw an error for invalid gap values", async () => {
    await assert.rejects(() => getRandomNetworkPorts("127.0.0.1", -10, 20), /Invalid port gap values provided/);
  });
});
