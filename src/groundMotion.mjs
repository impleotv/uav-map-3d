import {Cartesian3} from "cesium";

// Keep center/corner identities even when intersections are missing. Sharing
// these points between rays, outline and fill prevents their edges separating.
export function smoothGroundGeometry(previous, target, elapsed, project) {
  const oldPoints = previous && [previous.center, ...previous.corners];
  const newPoints = [target.center, ...target.corners];
  if (!previous || elapsed > 1 || newPoints.some((point, i) => point && oldPoints[i] && Cartesian3.distance(point, oldPoints[i]) > 10000)) return target;
  const alpha = -Math.expm1(-Math.max(0, elapsed) / 0.6);
  const ease = (before, after) => {
    if (!before || !after || Cartesian3.distance(before, after) < 0.001) return after;
    if (alpha === 0) return before;
    // Cartesian interpolation alone cuts under the globe. Reproject each
    // intermediate point onto the displayed terrain/ellipsoid surface.
    return project(Cartesian3.lerp(before, after, alpha, new Cartesian3()));
  };
  return {center:ease(previous.center,target.center),corners:target.corners.map((point,i)=>ease(previous.corners[i],point))};
}

export function equalGroundGeometry(a, b) {
  return !!a && !!b && Cartesian3.equals(a.center,b.center) &&
    a.corners.length === b.corners.length && a.corners.every((point,i)=>Cartesian3.equals(point,b.corners[i]));
}
