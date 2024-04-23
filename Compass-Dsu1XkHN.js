import{d as j,ax as B,p as M,D as O,u as I,q as m,ay as H,aC as $,y as z,aX as q,k as F,aT as L,aU as l,aY as X,v as x,aS as A,aP as Y,a0 as Z,o as G,c as J,a as i,h as V,a1 as K,aH as Q,b as r,aZ as ee,a8 as ae,ai as te,aj as se,ak as oe}from"./index-BH4BFxt-.js";import{g as c}from"./index-ZORhgBxb.js";const ne=o=>(te("data-v-073c2966"),o=o(),se(),o),le=["height","width"],ie={class:"w-full h-full"},re={class:"flex flex-col items-center justify-around"},ce={class:"flex items-center justify-between w-full my-1"},de=ne(()=>i("span",{class:"mr-1 text-slate-100"},"Heading style",-1)),ge={class:"w-40"};var R=(o=>(o.NORTH_UP="North Up",o.HEAD_UP="Head Up",o))(R||{});const ue=j({__name:"Compass",props:{widget:{}},setup(o){const U=B();M.registerUsage(O.heading);const y=I(),b=m(),d=m(),_=m(),E={0:"N",45:"NE",90:"E",135:"SE",180:"S",225:"SW",270:"W",315:"NW"},T=Object.values(R),n=H(o).widget;$(()=>{Object.keys(n.value.options).length===0&&(n.value.options={headingStyle:T[0]})}),z(()=>{N(),W()});const{width:k,height:C}=q(b),g=F(()=>k.value<C.value?k.value:C.value),W=()=>{if(d.value===void 0||d.value===null)return;_.value===void 0&&(_.value=d.value.getContext("2d"));const e=_.value;L(e);const a=.5*g.value,s=.13*g.value,p=.03*a;e.textAlign="center",e.strokeStyle="white",e.font=`bold ${s}px Arial`,e.fillStyle="white",e.lineWidth=p,e.textBaseline="middle";const v=.7*a,D=.4*a,S=.55*a;e.translate(a,a),e.font=`bold ${s}px Arial`,e.fillText(`${t.yawAngleDegrees.toFixed(0)}°`,.15*s,0),e.rotate(l(-90)),n.value.options.headingStyle=="Head Up"&&e.rotate(l(t.yawAngleDegrees));for(const[w,P]of Object.entries(E))e.save(),e.rotate(l(Number(w))),e.beginPath(),e.moveTo(S,0),e.lineTo(v,0),e.textBaseline="bottom",e.font=`bold ${.7*s}px Arial`,e.translate(v*1.025,0),e.rotate(l(90)),e.fillText(P,0,0),e.stroke(),e.restore();for(const w of X(360))w%9===0&&(e.save(),e.lineWidth=.25*p,e.rotate(l(Number(w))),e.beginPath(),e.moveTo(1.1*S,0),e.lineTo(v,0),e.stroke(),e.restore());e.beginPath(),e.arc(0,0,v,0,l(360)),e.stroke(),n.value.options.headingStyle=="North Up"?e.rotate(l(t.yawAngleDegrees)):e.rotate(-l(t.yawAngleDegrees)),e.beginPath(),e.lineWidth=1,e.strokeStyle="red",e.fillStyle="red";const h=.05*a;e.moveTo(D,h),e.lineTo(S-.5*h,0),e.lineTo(D,-h),e.lineTo(D,h),e.closePath(),e.fill(),e.stroke()},u=m(.01);let f;x(y.attitude,e=>{if(f===void 0){u.value=A(y.attitude.yaw),f=e.yaw;return}Math.abs(A(e.yaw-f))>.1&&(f=e.yaw,u.value=A(y.attitude.yaw))});const t=Y({yawAngleDegrees:0}),N=()=>{const e=u.value,a=e<0?e+360:e,s=t.yawAngleDegrees>270&&a<90,p=t.yawAngleDegrees<90&&a>270;s?(c.to(t,.05,{yawAngleDegrees:0}),c.fromTo(t,.05,{yawAngleDegrees:0},{yawAngleDegrees:a})):p?(c.to(t,.05,{yawAngleDegrees:360}),c.fromTo(t,.05,{yawAngleDegrees:360},{yawAngleDegrees:a})):c.to(t,.1,{yawAngleDegrees:a})};return x(u,()=>N()),x(t,()=>{U.isWidgetVisible(n.value)&&Z(()=>W())}),(e,a)=>(G(),J(ae,null,[i("div",{ref_key:"compassRoot",ref:b,class:"compass"},[i("canvas",{ref_key:"canvasRef",ref:d,height:g.value,width:g.value,class:"rounded-[15%] bg-slate-950/70"},null,8,le)],512),V(ee,{show:r(n).managerVars.configMenuOpen,"onUpdate:show":a[1]||(a[1]=s=>r(n).managerVars.configMenuOpen=s),class:"w-72"},{default:K(()=>[i("div",ie,[i("div",re,[i("div",ce,[de,i("div",ge,[V(Q,{modelValue:r(n).options.headingStyle,"onUpdate:modelValue":a[0]||(a[0]=s=>r(n).options.headingStyle=s),options:r(T)},null,8,["modelValue","options"])])])])])]),_:1},8,["show"])],64))}}),he=oe(ue,[["__scopeId","data-v-073c2966"]]);export{he as default};