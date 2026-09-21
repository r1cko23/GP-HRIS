import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveLocationDetails, type OfficeLocation } from "../location";

const GP: OfficeLocation = {
  id: "gp",
  name: "Green Pasture",
  address:
    "31st Floor, Unit 3101, AIC, Burgundy Tower, ADB Ave, Ortigas Center, Pasig, Metro Manila",
  latitude: 14.589545534556084,
  longitude: 121.06119405688462,
  radius_meters: 1000,
};

describe("resolveLocationDetails", () => {
  it("resolves GPS coords inside Green Pasture to name + address", () => {
    const details = resolveLocationDetails(
      "14.589545534556084,121.06119405688462",
      [GP]
    );
    assert.equal(details.name, "Green Pasture");
    assert.match(details.address, /Burgundy Tower/);
    assert.equal(details.isWithinAllowedArea, true);
  });

  it("resolves office name (biometric, no GPS string) to Green Pasture address", () => {
    const details = resolveLocationDetails("Green Pasture", [GP]);
    assert.equal(details.name, "Green Pasture");
    assert.match(details.address, /Burgundy Tower/);
    assert.ok(details.coordinates);
    assert.equal(details.isWithinAllowedArea, true);
  });
});
