import {globeLandMask} from '../../lib/supasquad-globe-land';
import type {GlobeLocation} from '../../lib/supasquad-locations';

// Adapted from the original Amsterdam Canvas globe (cffaae33).
// Keep its Fibonacci land lattice, depth shading and 150-second turn.
const TAU=Math.PI*2;
const rad=(degrees:number)=>degrees*Math.PI/180;
const tilt=rad(20),roll=rad(14);
const st=Math.sin(tilt),ct=Math.cos(tilt),sr=Math.sin(roll),cr=Math.cos(roll);

export function createGlobe(canvas:HTMLCanvasElement,locations:(GlobeLocation&{label:string})[],onPick:(index:number)=>void){
  const ctx=canvas.getContext('2d');
  if(!ctx)return null;
  const raw=atob(globeLandMask),golden=Math.PI*(3-Math.sqrt(5)),points:number[]=[];
  for(let i=0;i<14000;i++){
    if(!(raw.charCodeAt(i>>3)&(1<<(i&7))))continue;
    const sinLat=1-2*(i+.5)/14000,lon=(i*golden)%TAU;
    points.push(sinLat,Math.sqrt(1-sinLat*sinLat),Math.sin(lon),Math.cos(lon));
  }
  const pts=new Float32Array(points);
  const buckets=Array.from({length:6},(_,index)=>({xy:new Float32Array(pts.length/2),n:0,
    fill:`rgba(214,219,216,${.14+.68*((index+.5)/6)})`,size:.62+.8*((index+.5)/6)}));
  let width=0,height=0,dpr=1,angle=-rad(24.94),selected=0;
  let requested=true,onscreen=true,frame=0,last=0,lastPaint=0,disposed=false;
  let visible:{index:number;x:number;y:number}[]=[];

  function project(latitude:number,longitude:number){
    const lat=rad(latitude),lon=rad(longitude)+angle;
    const x=Math.cos(lat)*Math.sin(lon),z0=Math.cos(lat)*Math.cos(lon);
    const z=Math.sin(lat)*st+z0*ct,y=Math.sin(lat)*ct-z0*st;
    const radius=Math.min(width,height)*.43;
    return {x:width*.5+(x*cr+y*sr)*radius,y:height*.5-(y*cr-x*sr)*radius,z};
  }
  function draw(){
    if(!ctx||!width||!height)return;
    const ca=Math.cos(angle),sa=Math.sin(angle),radius=Math.min(width,height)*.43;
    const cx=width*.5,cy=height*.5,dot=Math.max(width*.00105,.65*dpr);
    for(const bucket of buckets)bucket.n=0;
    for(let i=0;i<pts.length;i+=4){
      const x=pts[i+1]*(pts[i+2]*ca+pts[i+3]*sa),z0=pts[i+1]*(pts[i+3]*ca-pts[i+2]*sa);
      const z=pts[i]*st+z0*ct;if(z<=.03)continue;
      const y=pts[i]*ct-z0*st,bucket=buckets[Math.min(5,Math.floor(z*6))];
      bucket.xy[bucket.n++]=cx+(x*cr+y*sr)*radius;
      bucket.xy[bucket.n++]=cy-(y*cr-x*sr)*radius;
    }
    ctx.clearRect(0,0,width,height);
    ctx.beginPath();ctx.arc(cx,cy,radius,0,TAU);ctx.strokeStyle='rgba(127,166,144,.14)';ctx.lineWidth=dpr;ctx.stroke();
    for(const bucket of buckets){
      ctx.fillStyle=bucket.fill;ctx.beginPath();const r=dot*bucket.size;
      for(let i=0;i<bucket.n;i+=2){ctx.moveTo(bucket.xy[i]+r,bucket.xy[i+1]);ctx.arc(bucket.xy[i],bucket.xy[i+1],r,0,TAU);}
      ctx.fill();
    }
    visible=[];
    locations.forEach((location,index)=>{
      const point=project(location.latitude,location.longitude);
      if(point.z<=.05)return; // Never show markers through the far side of the globe.
      visible.push({index,x:point.x/dpr,y:point.y/dpr});
      const active=index===selected,r=(active?5:3.5)*dpr;
      ctx.globalAlpha=Math.min(1,point.z/.2);
      ctx.fillStyle=active?'#c1ffdd':'#3ecf8e';
      ctx.beginPath();ctx.arc(point.x,point.y,r,0,TAU);ctx.fill();
      ctx.strokeStyle='rgba(62,207,142,.65)';ctx.lineWidth=dpr;
      ctx.setLineDash(location.precision==='country'?[2*dpr,3*dpr]:[]);
      ctx.beginPath();ctx.arc(point.x,point.y,(active?12:7)*dpr,0,TAU);ctx.stroke();ctx.setLineDash([]);
      if(active){
        ctx.fillStyle='rgba(62,207,142,.10)';ctx.beginPath();ctx.arc(point.x,point.y,19*dpr,0,TAU);ctx.fill();
        ctx.font=`${11*dpr}px Inter, sans-serif`;
        const textWidth=ctx.measureText(location.label).width;
        const labelX=Math.min(point.x+18*dpr,width-textWidth-12*dpr),labelY=Math.max(18*dpr,point.y-12*dpr);
        ctx.fillStyle='rgba(8,11,10,.9)';ctx.fillRect(labelX-5*dpr,labelY-13*dpr,textWidth+10*dpr,21*dpr);
        ctx.fillStyle='#d7fce8';ctx.fillText(location.label,labelX,labelY+2*dpr);
      }
      ctx.globalAlpha=1;
    });
  }
  function fit(){
    dpr=Math.min(window.devicePixelRatio||1,2);
    width=Math.round(canvas.clientWidth*dpr);height=Math.round(canvas.clientHeight*dpr);
    canvas.width=width;canvas.height=height;draw();
  }
  function tick(now:number){
    if(disposed)return;
    if(last)angle+=Math.min(now-last,100)/1000/150*TAU;
    last=now;
    if(now-lastPaint>=(width/dpr<400?48:31)){draw();lastPaint=now;}
    frame=requestAnimationFrame(tick);
  }
  function sync(){
    cancelAnimationFrame(frame);frame=0;last=0;
    if(!disposed&&requested&&onscreen&&!document.hidden)frame=requestAnimationFrame(tick);
  }
  function nearest(event:PointerEvent|MouseEvent){
    const bounds=canvas.getBoundingClientRect(),x=event.clientX-bounds.left,y=event.clientY-bounds.top;
    let result:number|null=null,distance=22;
    for(const point of visible){const next=Math.hypot(point.x-x,point.y-y);if(next<distance){result=point.index;distance=next;}}
    return result;
  }
  function click(event:MouseEvent){const index=nearest(event);if(index!==null)onPick(index);}
  function hover(event:PointerEvent){canvas.style.cursor=nearest(event)===null?'default':'pointer';}
  const resize=new ResizeObserver(fit);resize.observe(canvas);
  const intersection=new IntersectionObserver(entries=>{onscreen=entries[0].isIntersecting;sync();});intersection.observe(canvas);
  document.addEventListener('visibilitychange',sync);
  canvas.addEventListener('click',click);canvas.addEventListener('pointermove',hover);
  fit();sync();
  return {
    focus(index:number){selected=index;angle=-rad(locations[index].longitude);draw();},
    setRunning(value:boolean){requested=value;sync();},
    destroy(){disposed=true;cancelAnimationFrame(frame);resize.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',sync);canvas.removeEventListener('click',click);canvas.removeEventListener('pointermove',hover);},
  };
}
