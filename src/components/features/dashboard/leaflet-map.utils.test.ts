import { describe, expect, it, vi } from "vitest";
import { createMarkerIconElement } from "./leaflet-map.utils";

const maliciousMarker = {
  regionId: "region-1",
  name: '<img src=x onerror="alert(1)">',
  centerName: "<script>alert(2)</script>",
  lat: 24,
  lng: 45,
  studyCount: 2,
};

describe("createMarkerIconElement", () => {
  it("renders API-derived labels as text instead of executable HTML", () => {
    const element = createMarkerIconElement(maliciousMarker, false, 30, vi.fn());

    expect(element.querySelector("img")).toBeNull();
    expect(element.querySelector("script")).toBeNull();
    expect(element.textContent).toContain(maliciousMarker.name);
    expect(element.textContent).toContain(maliciousMarker.centerName);
  });

  it.each(["Enter", " "])("supports %j keyboard activation", (key) => {
    const onActivate = vi.fn();
    const element = createMarkerIconElement(maliciousMarker, false, 30, onActivate);

    expect(element.role).toBe("button");
    expect(element.tabIndex).toBe(0);
    expect(element.getAttribute("aria-label")).toContain("2 studies");

    element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    expect(onActivate).toHaveBeenCalledOnce();
  });
});
