import{c as O,af as $,K as B,L as G,M as I,u as j,ag as K,r as m,aA as Z,aj as q,o as J,T as Q,k as ee,w as C,aC as E,aE as ae,U as te,aD as oe,m as se,n as ne,p as D,H as l,W as r,a4 as le,X as ie,v as s,ar as re,Z as P,a5 as ue,aG as k,aI as de,aa as ce,F as he,aF as fe,_ as ge}from"./index-DufFVCyA.js";import{w as V}from"./index-DxaGCbJO.js";import{g as pe}from"./index-DjKJqAo0.js";import{V as we,a as ve,b as me,c as Ce}from"./VExpansionPanel-DPL55zag.js";const Ve={class:"main"},Se=["width","height"],be=O({__name:"CompassHUD",props:{widget:{}},setup(A){const S=$(),X=B();G.registerUsage(I.heading);const R=j(),a=K(A).widget,_=m([["#FFFFFF"],["#FF2D2D"],["#0ADB0ACC"]]),L=e=>{switch(e){case-180:return"S";case-135:return"SW";case-90:return"W";case-45:return"NW";case 0:return"N";case 45:return"NE";case 90:return"E";case 135:return"SE";case 180:return"S";case 225:return"SW";case 270:return"W";case 315:return"NW";case 360:return"N";default:return`${e}°`}},c=Z({yawLinesX:{}}),b=[];let x=-180;for(;x<181;)b.push(x),x+=3;q(()=>{Object.keys(a.value.options).length===0&&(a.value.options={showYawValue:!0,hudColor:_.value[0][0],useNegativeRange:!1})}),J(()=>{b.forEach(e=>c.yawLinesX[e]=M(e)),y()});const{width:U}=Q(),u=ee(()=>({width:a.value.size.width*U.value,height:64})),w=m(0);let W;C(R.attitude,e=>{Math.abs(E(e.yaw-(W||0)))>.1&&(W=e.yaw,w.value=E(R.attitude.yaw))});const M=e=>{let o=-(e-w.value||0);return o<-180?o+=360:o>180&&(o-=360),-o},h=m(),F=m(),y=()=>{if(h.value===void 0||h.value===null)return;if(F.value===void 0){console.debug("Canvas context undefined!"),F.value=h.value.getContext("2d");return}const e=F.value;ae(e);const t=.5*u.value.width,o=.5*u.value.height,N=12,d=16,f=10,n=2,Y=7;e.textAlign="center",e.strokeStyle="white",e.font=`bold ${N}px Arial`,e.fillStyle="white";for(const[i,T]of Object.entries(c.yawLinesX)){if(T<-90||T>90)continue;const H=2*t/Math.PI*Math.sin(fe(T)),v=t+H;if(e.beginPath(),e.moveTo(v,d+n+f+n),e.lineTo(v,o*2-N-n-Y),e.lineWidth="1",Number(i)%15===0){e.lineWidth="2",e.lineTo(v,o*2-N-n);let p=Number(i);a.value.options.useNegativeRange||(p=p<0?p+360:p),e.fillText(L(Number(p)),v,o*2-n)}e.stroke()}if(a.value.options.showYawValue){e.font=`bold ${d}px Arial`;let i=Number(w.value);a.value.options.useNegativeRange||(i=i<0?i+360:i),e.fillText(`${i.toFixed(1)}°`,t,d)}e.beginPath(),e.moveTo(t,d+n+f),e.lineTo(t-.5*f,n+d+n),e.lineTo(t+.5*f,n+d+n),e.lineTo(t,d+n+f),e.closePath(),e.fill(),e.globalCompositeOperation="source-in";const g=e.createLinearGradient(0,o,u.value.width,o);g.addColorStop(.18,V(a.value.options.hudColor).alpha(0).toRgbString()),g.addColorStop(.3,V(a.value.options.hudColor).alpha(1).toRgbString()),g.addColorStop(.7,V(a.value.options.hudColor).alpha(1).toRgbString()),g.addColorStop(.82,V(a.value.options.hudColor).alpha(0).toRgbString()),e.fillStyle=g,e.fillRect(0,0,u.value.width,o*2)};C(w,()=>{b.forEach(e=>{const t=M(e);Math.abs(c.yawLinesX[e]-t)>90?c.yawLinesX[e]=t:pe.to(c.yawLinesX,{duration:2.5,ease:"elastic.out(1.2, 0.5)",[e]:t})})}),C([c,u,a.value.options],()=>{S.isWidgetVisible(a.value)&&te(()=>y())});const z=oe(h);return C(z,(e,t)=>{e&&!t&&y()}),(e,t)=>(se(),ne(he,null,[D("div",Ve,[D("canvas",{ref_key:"canvasRef",ref:h,width:u.value.width,height:u.value.height},null,8,Se)]),l(ce,{modelValue:s(S).widgetManagerVars(s(a).hash).configMenuOpen,"onUpdate:modelValue":t[3]||(t[3]=o=>s(S).widgetManagerVars(s(a).hash).configMenuOpen=o),"min-width":"400","max-width":"35%"},{default:r(()=>[l(le,{class:"px-8 pb-6 pt-2",style:ie(s(X).globalGlassMenuStyles)},{default:r(()=>[l(re,{class:"text-center"},{default:r(()=>[P("HUD Compass widget config")]),_:1}),l(ue,null,{default:r(()=>[l(k,{class:"ma-1",label:"Show yaw value",color:s(a).options.showYawValue?"white":void 0,"model-value":s(a).options.showYawValue,"hide-details":"",onChange:t[0]||(t[0]=o=>s(a).options.showYawValue=!s(a).options.showYawValue)},null,8,["color","model-value"]),l(k,{class:"ma-1",label:"Use -180/+180 range",color:s(a).options.useNegativeRange?"white":void 0,"model-value":s(a).options.useNegativeRange,"hide-details":"",onChange:t[1]||(t[1]=o=>s(a).options.useNegativeRange=!s(a).options.useNegativeRange)},null,8,["color","model-value"]),l(we,null,{default:r(()=>[l(ve,{class:"bg-[#FFFFFF11] text-white mt-2"},{default:r(()=>[l(me,null,{default:r(()=>[P("Color")]),_:1}),l(Ce,null,{default:r(()=>[l(de,{modelValue:s(a).options.hudColor,"onUpdate:modelValue":t[2]||(t[2]=o=>s(a).options.hudColor=o),theme:"dark",class:"ma-1 bg-[#FFFFFF11] text-white",swatches:_.value,width:"100%","show-swatches":""},null,8,["modelValue","swatches"])]),_:1})]),_:1})]),_:1})]),_:1})]),_:1},8,["style"])]),_:1},8,["modelValue"])],64))}}),Re=ge(be,[["__scopeId","data-v-246f3d78"]]);export{Re as default};