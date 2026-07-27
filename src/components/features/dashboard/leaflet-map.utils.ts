import type { MapRegionMarker } from "./leaflet-map";

export function createMarkerIconElement(
  marker: MapRegionMarker,
  isSelected: boolean,
  size: number,
  onActivate: () => void,
): HTMLElement {
  const root = document.createElement("div");
  root.className =
    "relative flex flex-col items-center justify-center cursor-pointer select-none group";
  root.tabIndex = 0;
  root.role = "button";
  root.setAttribute(
    "aria-label",
    `${marker.name}: ${marker.studyCount} ${marker.studyCount === 1 ? "study" : "studies"}`,
  );
  root.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onActivate();
    }
  });

  const label = document.createElement("div");
  label.className = "text-center font-sans leading-tight mb-1 pointer-events-none";

  if (marker.centerName) {
    const center = document.createElement("div");
    center.style.cssText = "font-size: 9px; color: #6b7280; font-weight: 500;";
    center.textContent = marker.centerName;
    label.append(center);
  }

  const name = document.createElement("div");
  name.style.cssText = `font-size: 11px; font-weight: ${
    isSelected ? "700" : "600"
  }; color: #111827; white-space: nowrap;`;
  name.textContent = marker.name;
  label.append(name);

  const count = document.createElement("div");
  count.style.cssText = `
    width: ${size}px;
    height: ${size}px;
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 13px;
    transition: all 0.2s ease;
    ${
      isSelected
        ? "background-color: #000000; color: #ffffff; border: 2px solid #ffffff; box-shadow: 0 0 0 3px #000000;"
        : "background-color: #ffffff; color: #111827; border: 2px solid #111827; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"
    }
  `;
  count.textContent = String(marker.studyCount);
  root.append(label, count);

  return root;
}
