// GTX: big-endian origin/step float64, rows/columns int32, then float32 metres.
export function readGeoidGrid(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 40) throw new Error("Invalid geoid grid");
  const south = view.getFloat64(0), west = view.getFloat64(8);
  const dy = view.getFloat64(16), dx = view.getFloat64(24);
  const rows = view.getInt32(32), columns = view.getInt32(36);
  if (rows < 2 || columns < 2 || dy <= 0 || dx <= 0 || 40 + rows * columns * 4 !== view.byteLength) throw new Error("Invalid geoid grid dimensions");
  const values = new Float32Array(rows * columns);
  for (let i = 0; i < values.length; i++) values[i] = view.getFloat32(40 + i * 4);
  return (latitude, longitude) => {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90) throw new Error("Invalid geoid coordinates");
    const x = (((longitude - west) / dx) % columns + columns) % columns;
    const y = Math.max(0, Math.min(rows - 1, (latitude - south) / dy));
    const ix = Math.floor(x), iy = Math.min(rows - 2, Math.floor(y));
    const fx = x - ix, fy = y - iy;
    const at = (r, c) => values[r * columns + c % columns];
    return (1-fy) * ((1-fx)*at(iy,ix)+fx*at(iy,ix+1)) + fy*((1-fx)*at(iy+1,ix)+fx*at(iy+1,ix+1));
  };
}
