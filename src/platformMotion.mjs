import {Cartesian3, Quaternion} from "cesium";

// Presentation-only easing. Keep raw telemetry at the newest sample, and never
// extrapolate after updates stop.
export function smoothPlatformPose(previous, target, elapsed) {
  if (!previous || elapsed > 1 || Cartesian3.distance(previous.position, target.position) > 10000) return target;
  const alpha = -Math.expm1(-Math.max(0, elapsed) / 0.6);
  const position = Cartesian3.distance(previous.position, target.position) < 0.001 ? target.position :
    Cartesian3.lerp(previous.position, target.position, alpha, new Cartesian3());
  let orientation = target.orientation;
  if (previous.orientation && orientation && 1 - Math.abs(Quaternion.dot(previous.orientation, orientation)) >= 1e-12) {
    orientation = alpha === 0 ? previous.orientation :
      Quaternion.normalize(Quaternion.slerp(previous.orientation, orientation, alpha, new Quaternion()), new Quaternion());
  }
  return {position, orientation};
}
