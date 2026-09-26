import {Cartesian3, Ellipsoid} from "cesium";

// Intersect the reported range sphere with the target's geodetic vertical.
// Choose the ground solution below the platform, never replace an absent range
// or impossible geometry with an invented altitude.
export function groundReferenceFromRange(origin, surfaceTarget, range) {
  if (!surfaceTarget || !(range>0)) return undefined;
  const normal=Ellipsoid.WGS84.geodeticSurfaceNormal(surfaceTarget,new Cartesian3());
  const relative=Cartesian3.subtract(origin,surfaceTarget,new Cartesian3());
  const vertical=Cartesian3.dot(relative,normal);
  const horizontalSquared=Math.max(0,Cartesian3.magnitudeSquared(relative)-vertical*vertical);
  const discriminant=range*range-horizontalSquared;
  if (discriminant<0) return undefined;
  return Cartesian3.add(surfaceTarget,Cartesian3.multiplyByScalar(normal,vertical-Math.sqrt(discriminant),new Cartesian3()),new Cartesian3());
}

// On an ellipsoid-only map, the reported target elevation is not drawn.
// Translate the camera by the same displacement as the displayed target,
// preserving the measured sensor rotation, roll and angular field of view.
// This is a display approximation; it never changes the platform's position.
export function sensorViewPosition({origin,direction,frameCenter,range,ellipsoidGround,project}) {
  if (!ellipsoidGround) return {position:origin,approximate:false};
  const reference=frameCenter || (direction&&range>0
    ? Cartesian3.add(origin,Cartesian3.multiplyByScalar(direction,range,new Cartesian3()),new Cartesian3())
    : undefined);
  if (!reference) return {position:origin,approximate:false};
  const displacement=Cartesian3.subtract(project(reference),reference,new Cartesian3());
  return {position:Cartesian3.add(origin,displacement,new Cartesian3()),approximate:Cartesian3.magnitude(displacement)>1};
}
