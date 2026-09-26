import {Cartesian3, Matrix3, Quaternion} from "cesium";

export const sensorZoom = (zoom, factor) => Math.min(16, Math.max(0.25, zoom * factor));

export function sensorLens(fov, zoom) {
  // Scale focal length, preserving the sensor's horizontal/vertical ratio.
  const h = Math.tan(fov.horizontal * Math.PI / 360);
  const v = Math.tan(fov.vertical * Math.PI / 360);
  const scale = Math.min(1 / zoom, Math.tan(85 * Math.PI / 180) / Math.max(h, v));
  return {h: h * scale, v: v * scale};
}

function rotation({direction, up}) {
  const right = Cartesian3.normalize(Cartesian3.cross(direction, up, new Cartesian3()), new Cartesian3());
  const matrix = new Matrix3();
  Matrix3.setColumn(matrix, 0, right, matrix);
  Matrix3.setColumn(matrix, 1, up, matrix);
  Matrix3.setColumn(matrix, 2, Cartesian3.negate(direction, new Cartesian3()), matrix);
  return Quaternion.normalize(Quaternion.fromRotationMatrix(matrix), new Quaternion());
}

// Follow telemetry gently (600 ms), while lens/zoom changes respond in 120 ms.
// Both are frame-rate independent and never predict beyond the last sample.
// Reset after suspension or a teleport.
export function smoothSensorCamera(previous, target, elapsed) {
  if (!previous || elapsed > 1 || Cartesian3.distance(previous.position, target.position) > 10000) return target;
  const a = rotation(previous), b = rotation(target);
  const settled = Cartesian3.distance(previous.position, target.position) < 0.001 &&
    1 - Math.abs(Quaternion.dot(a, b)) < 1e-12 &&
    Math.abs(previous.h - target.h) < 1e-7 && Math.abs(previous.v - target.v) < 1e-7;
  if (settled) return target;
  const alpha = -Math.expm1(-Math.max(0, elapsed) / 0.6);
  const lensAlpha = -Math.expm1(-Math.max(0, elapsed) / 0.12);
  const matrix = Matrix3.fromQuaternion(Quaternion.slerp(a, b, alpha, new Quaternion()));
  return {
    position: Cartesian3.equals(previous.position, target.position) ? target.position :
      Cartesian3.lerp(previous.position, target.position, alpha, new Cartesian3()),
    direction: Cartesian3.negate(Matrix3.getColumn(matrix, 2, new Cartesian3()), new Cartesian3()),
    up: Matrix3.getColumn(matrix, 1, new Cartesian3()),
    h: previous.h + (target.h - previous.h) * lensAlpha,
    v: previous.v + (target.v - previous.v) * lensAlpha,
  };
}
