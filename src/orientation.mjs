import {Matrix3, Matrix4, Quaternion, Transforms} from "cesium";
import {sceneAxes} from "./math.mjs";

export function modelOrientation(position, attitude, alignment) {
  const axes=sceneAxes(attitude,alignment);
  // Presets/import convention: glTF +X nose, +Y up, +Z right.
  // Cesium's entity loader applies BOTH Y-up -> Z-up and Z-forward -> X-forward.
  // Together these map the authored nose to +Y, right to +X, and up to +Z.
  const local=new Matrix3(
    axes.right[0],axes.forward[0],axes.up[0],
    axes.right[1],axes.forward[1],axes.up[1],
    axes.right[2],axes.forward[2],axes.up[2]);
  const enu=Matrix4.getMatrix3(Transforms.eastNorthUpToFixedFrame(position),new Matrix3());
  return Quaternion.fromRotationMatrix(Matrix3.multiply(enu,local,new Matrix3()));
}
