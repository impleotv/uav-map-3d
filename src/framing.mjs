import { BoundingSphere } from "cesium";

// Include the displayed ground intersections, not only the airborne origins.
export function sceneBounds(entries, extraPoints = []) {
  const points = [...extraPoints];
  for (const entry of entries) {
    if (entry.config.visible === false) continue;
    if (entry.targetPoint) points.push(entry.targetPoint);
    if (entry.position) {
      points.push(entry.position);
      for (const line of entry.lines) points.push(...line);
      if (entry.footprint) points.push(...entry.footprint);
    }
  }
  return points.length ? BoundingSphere.fromPoints(points) : undefined;
}

export function framingRange(radius, fovy, aspectRatio, width, height) {
  // Leave room for the minimum-size aircraft and its label on every edge.
  // A sphere's angular radius is asin(radius / distance), not atan(...).
  const usableX = Math.max(0.2, 1 - 192 / Math.max(1, width));
  const usableY = Math.max(0.2, 1 - 192 / Math.max(1, height));
  const vertical = Math.tan(fovy / 2);
  const halfAngle = Math.atan(Math.min(vertical * usableY, vertical * aspectRatio * usableX));
  return Math.max(1000, radius / Math.sin(halfAngle));
}
