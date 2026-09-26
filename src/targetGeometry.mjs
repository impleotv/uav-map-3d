import {Cartesian3, Matrix4, Transforms, Ellipsoid} from "cesium";

// One projective image-to-ground transform shared by the entire frame. Work in
// local metres so dateline wrapping and latitude scale never enter the solve.
export function footprintProjection(corners) {
  if(corners?.length!==4||!corners.every(p=>p&&[p.x,p.y,p.z].every(Number.isFinite)))return null;
  const average=corners.reduce((sum,p)=>Cartesian3.add(sum,p,sum),new Cartesian3());
  Cartesian3.divideByScalar(average,4,average);
  const origin=Ellipsoid.WGS84.scaleToGeodeticSurface(average);
  if(!origin)return null;
  const world=Transforms.eastNorthUpToFixedFrame(origin),local=Matrix4.inverseTransformation(world,new Matrix4());
  const points=corners.map(p=>Matrix4.multiplyByPoint(local,p,new Cartesian3()));
  const scale=Math.max(...points.map((p,i)=>Cartesian3.distance(p,points[(i+1)%4])));
  if(scale<0.001)return null;
  const cross=points.map((a,i)=>{
    const b=points[(i+1)%4],c=points[(i+2)%4];
    return (b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
  });
  if(cross.some(c=>Math.abs(c)<scale*scale*1e-10)||!cross.every(c=>Math.sign(c)===Math.sign(cross[0])))return null;
  const [a,b,c,d]=points;
  const dx1=b.x-c.x,dx2=d.x-c.x,dy1=b.y-c.y,dy2=d.y-c.y;
  const sx=a.x-b.x+c.x-d.x,sy=a.y-b.y+c.y-d.y;
  const det=dx1*dy2-dx2*dy1;
  if(Math.abs(det)<scale*scale*1e-10)return null;
  const g=(sx*dy2-dx2*sy)/det,h=(dx1*sy-sx*dy1)/det;
  if([1,1+g,1+h,1+g+h].some(v=>v<=1e-8))return null;
  const ax=b.x-a.x+g*b.x,bx=d.x-a.x+h*d.x;
  const ay=b.y-a.y+g*b.y,by=d.y-a.y+h*d.y;
  const xy=(u,v)=>new Cartesian3((ax*u+bx*v+a.x)/(g*u+h*v+1),(ay*u+by*v+a.y)/(g*u+h*v+1),0);
  return {xy,toLocal:p=>Matrix4.multiplyByPoint(local,p,new Cartesian3()),toWorld:p=>Matrix4.multiplyByPoint(world,p,new Cartesian3())};
}

const world=p=>Cartesian3.fromDegrees(p.longitude,p.latitude,0);
export function placeTarget(target,mapping) {
  if(target.boundary?.length>=3)return {points:target.boundary.map(world),closed:true,estimated:false,description:target.boundaryKind||"Reported geographic boundary"};
  const {box,centroid,center}=target;
  if(mapping&&box) {
    const points=[[box.left,box.top],[box.right,box.top],[box.right,box.bottom],[box.left,box.bottom]].map(([u,v])=>mapping.xy(u,v));
    if(center) {
      const anchor=mapping.xy(centroid?.x??(box.left+box.right)/2,centroid?.y??(box.top+box.bottom)/2);
      const reported=mapping.toLocal(world(center));
      for(const p of points){p.x+=reported.x-anchor.x;p.y+=reported.y-anchor.y;}
    }
    return {points:points.map(mapping.toWorld),closed:true,estimated:true,description:center?"Reported location · estimated extent":"Estimated from frame footprint"};
  }
  if(center)return {points:[world(center)],closed:false,estimated:false,description:"Reported location · extent unavailable"};
  if(mapping&&centroid)return {points:[mapping.toWorld(mapping.xy(centroid.x,centroid.y))],closed:false,estimated:true,description:"Estimated location · extent unavailable"};
  return null;
}

// Short segments sample the loaded surface. No remote terrain queries per target.
export function targetSurfacePoints(placement,project) {
  const lift=point=>{
    const p=project(point),normal=Ellipsoid.WGS84.geodeticSurfaceNormal(p,new Cartesian3());
    return Cartesian3.add(p,Cartesian3.multiplyByScalar(normal,0.5,normal),new Cartesian3());
  };
  if(!placement.closed)return [lift(placement.points[0])];
  const points=[];
  for(let i=0;i<placement.points.length;i++) {
    const a=placement.points[i],b=placement.points[(i+1)%placement.points.length];
    for(let j=0;j<4;j++)points.push(lift(Cartesian3.lerp(a,b,j/4,new Cartesian3())));
  }
  points.push(points[0]);
  return points;
}
