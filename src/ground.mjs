import {Cartesian3, Ellipsoid, Plane, Ray, IntersectionTests} from "cesium";
import {fovCornerDirections} from "./math.mjs";

// Reported ground coordinates take precedence over a footprint reconstructed
// from attitude. A bare ellipsoid is not terrain at the target's elevation.
export function sensorGroundGeometry({origin, axes, fov, frameCenter, frameCorners, frameCenterSurface, frameCornerSurfaces, frameCenterOffEarth, frameCornersOffEarth, range, ellipsoidGround, intersect, project}) {
  const direction=axes?.forward;
  const ranged=direction&&range>0 ? Cartesian3.add(origin,Cartesian3.multiplyByScalar(direction,range,new Cartesian3()),new Cartesian3()) : undefined;
  const reference=frameCenter || (ellipsoidGround?ranged:undefined);
  const plane=reference ? Plane.fromPointNormal(reference,Ellipsoid.WGS84.geodeticSurfaceNormal(reference,new Cartesian3())) : undefined;
  const hit=ray=>ellipsoidGround&&plane
    ? IntersectionTests.rayPlane(new Ray(origin,ray),plane)
    : intersect(ray);
  const center=frameCenterOffEarth?undefined:frameCenter || (direction?hit(direction):undefined);
  let corners=Array.from({length:4},(_,i)=>frameCorners?.[i] || frameCornerSurfaces?.[i]);
  const reported=corners.some(Boolean);
  if(axes&&fov&&corners.some((point,i)=>!point&&!frameCornersOffEarth?.[i])) {
    const array=v=>[v.x,v.y,v.z];
    const estimated=fovCornerDirections({forward:array(axes.forward),right:array(axes.right),up:array(axes.up)},fov)
      .map(ray=>hit(new Cartesian3(...ray)));
    corners=corners.map((point,i)=>point||estimated[i]);
  }
  corners=corners.map((point,i)=>frameCornersOffEarth?.[i]?undefined:point);
  const projected=Boolean(frameCenter||frameCenterSurface||reported||(ellipsoidGround&&reference));
  const display=point=>point&&(projected?project(point):point);
  const complete=corners.length===4&&corners.every(Boolean);
  const description=reported?"Reported metadata footprint":complete?"Approximate FOV":frameCenter||frameCenterSurface?"Reported frame center":"FOV ground intersection incomplete";
  const surface=projected ? ellipsoidGround?"projected onto WGS84 ellipsoid; terrain elevation not displayed":"projected onto loaded terrain (ellipsoid where unavailable)"
    : ellipsoidGround?"on WGS84 ellipsoid":"on currently loaded terrain";
  const offEarth=frameCenterOffEarth||frameCornersOffEarth?.some(Boolean);
  return {center:frameCenterOffEarth?undefined:frameCenterSurface||display(center),corners:corners.some(Boolean)?corners.map(display):[],status:`${description} · ${surface}${offEarth?" · Off-earth endpoints hidden":""}`};
}

// Never close across an unavailable corner or fill an incomplete footprint.
export function groundOutlineSegments(corners) {
  if(corners.length!==4) return [];
  if(corners.every(Boolean)) return [[...corners,corners[0]]];
  return corners.flatMap((point,i)=>point&&corners[(i+1)%4] ? [[point,corners[(i+1)%4]]] : []);
}
