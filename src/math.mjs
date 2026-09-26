// Row-major rotation from forward/right/down body axes into north/east/down.
export function nedRotation({ heading, pitch, roll }) {
  const [h, p, r] = [heading, pitch, roll].map(x => x * Math.PI / 180);
  const ch = Math.cos(h), sh = Math.sin(h), cp = Math.cos(p), sp = Math.sin(p), cr = Math.cos(r), sr = Math.sin(r);
  return [ch*cp, ch*sp*sr-sh*cr, ch*sp*cr+sh*sr,
    sh*cp, sh*sp*sr+ch*cr, sh*sp*cr-ch*sr,
    -sp, cp*sr, cp*cr];
}

export function multiplyRotation(a, b) {
  return Array.from({ length: 9 }, (_, i) => {
    const row = Math.floor(i / 3), col = i % 3;
    return a[row*3]*b[col] + a[row*3+1]*b[col+3] + a[row*3+2]*b[col+6];
  });
}

/** @param {{heading:number,pitch:number,roll:number}} attitude
 * @param {{heading:number,pitch:number,roll:number}|null} sensor */
export function sceneAxes(attitude, sensor = null) {
  let rotation = nedRotation(attitude);
  if (sensor) rotation = multiplyRotation(rotation, nedRotation(sensor));
  const column = i => [rotation[3+i], rotation[i], -rotation[6+i]]; // NED -> ENU
  return { forward: column(0), right: column(1), up: column(2).map(x => -x) };
}

// Clockwise image corners, starting at upper left, in the caller's frame.
export function fovCornerDirections({forward, right, up}, {horizontal, vertical}) {
  const x = Math.tan(horizontal * Math.PI / 360);
  const y = Math.tan(vertical * Math.PI / 360);
  return [[-1,1],[1,1],[1,-1],[-1,-1]].map(([sx,sy]) => {
    const ray = forward.map((value,i) => value + sx*x*right[i] + sy*y*up[i]);
    const length = Math.hypot(...ray);
    return ray.map(value => value / length);
  });
}
