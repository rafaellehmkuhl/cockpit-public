import{bg as ve,bh as Me,bi as ye,bj as P,bk as Te,bl as te,bm as ke,bn as we,d as xe,bd as Ie,aJ as Ae,u as Se,bo as Ve,p as g,k as _,m as ae,D as ne,aN as Oe,bp as m,x as Ce,bq as M,al as De,q as y,br as Ee,a$ as Ne,v as _e,bs as ie,O as Le,aI as Re,f as He,o as G,c as le,a as U,w as se,h as x,n as re,b as p,an as C,M as $,aq as ze,j as ue,z as F,V as Pe,A as Ue,F as $e,B as Fe,b2 as Be,N as Xe,i as We,ad as Ye,K as qe,s as je,e as Ze,E as Ge,aP as ce}from"./index-BZEa2BlN.js";function me(i,v){if(i==null)throw new TypeError("assign requires that input parameter not be null or undefined");for(var l in v)Object.prototype.hasOwnProperty.call(v,l)&&(i[l]=v[l]);return i}function Ke(i){return me({},i)}var de=1440,Je=2520,K=43200,Qe=86400;function eo(i,v,l){var r,f;ve(2,arguments);var t=we(),s=(r=(f=l==null?void 0:l.locale)!==null&&f!==void 0?f:t.locale)!==null&&r!==void 0?r:Me;if(!s.formatDistance)throw new RangeError("locale must contain formatDistance property");var b=ye(i,v);if(isNaN(b))throw new RangeError("Invalid time value");var n=me(Ke(l),{addSuffix:!!(l!=null&&l.addSuffix),comparison:b}),I,A;b>0?(I=P(v),A=P(i)):(I=P(i),A=P(v));var T=Te(A,I),B=(te(A)-te(I))/1e3,c=Math.round((T-B)/60),d;if(c<2)return l!=null&&l.includeSeconds?T<5?s.formatDistance("lessThanXSeconds",5,n):T<10?s.formatDistance("lessThanXSeconds",10,n):T<20?s.formatDistance("lessThanXSeconds",20,n):T<40?s.formatDistance("halfAMinute",0,n):T<60?s.formatDistance("lessThanXMinutes",1,n):s.formatDistance("xMinutes",1,n):c===0?s.formatDistance("lessThanXMinutes",1,n):s.formatDistance("xMinutes",c,n);if(c<45)return s.formatDistance("xMinutes",c,n);if(c<90)return s.formatDistance("aboutXHours",1,n);if(c<de){var h=Math.round(c/60);return s.formatDistance("aboutXHours",h,n)}else{if(c<Je)return s.formatDistance("xDays",1,n);if(c<K){var N=Math.round(c/de);return s.formatDistance("xDays",N,n)}else if(c<Qe)return d=Math.round(c/K),s.formatDistance("aboutXMonths",d,n)}if(d=ke(A,I),d<12){var L=Math.round(c/K);return s.formatDistance("xMonths",L,n)}else{var R=d%12,D=Math.floor(d/12);return R<3?s.formatDistance("aboutXYears",D,n):R<9?s.formatDistance("overXYears",D,n):s.formatDistance("almostXYears",D+1,n)}}function oo(i,v){return ve(1,arguments),eo(i,Date.now(),v)}(function(i){let v;if(typeof define=="function"&&define.amd)define(["leaflet"],i);else if(typeof module=="object"&&typeof module.exports=="object")v=require("leaflet"),module.exports=i(v);else{if(typeof window.L>"u")throw"Leaflet must be loaded first";i(window.L)}})(function(i){const v=i.Marker.prototype._initIcon,l=i.Marker.prototype._setPos,r=i.DomUtil.TRANSFORM==="msTransform";i.Marker.addInitHook(function(){let t=this.options.icon&&this.options.icon.options&&this.options.icon.options.iconAnchor;t&&(t=t[0]+"px "+t[1]+"px"),this.options.rotationOrigin=this.options.rotationOrigin||t||"center bottom",this.options.rotationAngle=this.options.rotationAngle||0,this.on("drag",function(s){s.target._applyRotation()})}),i.Marker.include({_initIcon:function(){v.call(this)},_setPos:function(f){l.call(this,f),this._applyRotation()},_applyRotation:function(){this.options.rotationAngle&&(this._icon.style[i.DomUtil.TRANSFORM+"Origin"]=this.options.rotationOrigin,r?this._icon.style[i.DomUtil.TRANSFORM]="rotate("+this.options.rotationAngle+"deg)":this._icon.style[i.DomUtil.TRANSFORM]+=" rotateZ("+this.options.rotationAngle+"deg)")},setRotationAngle:function(f){return this.options.rotationAngle=f,this.update(),this},setRotationOrigin:function(f){return this.options.rotationOrigin=f,this.update(),this}})});const to=""+new URL("blueboat-marker-DyHmCFOq.png",import.meta.url).href,ao=""+new URL("brov2-marker-CBzp11FX.png",import.meta.url).href,no=""+new URL("generic-vehicle-marker-SovxT5Tc.png",import.meta.url).href,io={class:"page-base"},lo=["id"],ro=xe({__name:"Map",props:{widget:{}},setup(i){var oe;Ie(e=>({c7bf1cd8:be.value}));const v=i,l=Ae(v).widget,r=Se(),f=Ve(),t=g(),s=g(15),b=g([-27.5935,-48.55854]),n=g(b.value),I=_(()=>`map-${l.value.hash}`);ae.registerUsage(ne.latitude),ae.registerUsage(ne.longitude),Oe(()=>{Object.keys(l.value.options).length===0&&(l.value.options={showVehiclePath:!0}),d.enableAutoUpdate()});const A=m.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"}),T=m.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19,attribution:"© Esri World Imagery"}),B={OpenStreetMap:A,"Esri World Imagery":T};Ce(async()=>{t.value=m.map(I.value,{layers:[A,T]}).setView(b.value,s.value),t.value.zoomControl.setPosition("bottomright"),t.value.on("moveend",()=>{if(t.value===void 0)return;let{lat:o,lng:a}=t.value.getCenter();o&&a&&(b.value=[o,a])}),t.value.on("zoomend",()=>{var o;t.value!==void 0&&(s.value=((o=t.value)==null?void 0:o.getZoom())??b.value)}),t.value.on("click",()=>{t.value!==void 0&&t.value.on("click",J)}),t.value.on("contextmenu",()=>{Q()});const e=m.control.layers(B);t.value.addControl(e),d.enableAutoUpdate(),window.addEventListener("keydown",ee),d.goToTarget(M.HOME)}),De(()=>{d.disableAutoUpdate(),window.removeEventListener("keydown",ee),t.value&&(t.value.off("click",J),t.value.off("contextmenu"))}),y(b,(e,o)=>{var a,u,S;e.toString()!==o.toString()&&((a=t.value)==null||a.panTo(e),(S=(u=V.value)==null?void 0:u.getTooltip())==null||S.setContent(`Home: ${e[0].toFixed(6)}, ${e[1].toFixed(6)}`))}),y(t,(e,o)=>{t.value!==void 0&&(e==null?void 0:e.options)===void 0&&(t.value=o)}),y(s,(e,o)=>{var a;e!==o&&((a=t.value)==null||a.setZoom(s.value))}),y(v.widget,()=>{var e;(e=t.value)==null||e.invalidateSize()});const c=g(void 0),d=new Ee(e=>c.value=e,e=>b.value=e);d.setTrackableTarget(M.VEHICLE,()=>h.value),d.setTrackableTarget(M.HOME,()=>n.value);const h=_(()=>r.coordinates.latitude?[r.coordinates.latitude,r.coordinates.longitude]:void 0),N=_(()=>{var e;return r.attitude.yaw?Ne((e=r.attitude)==null?void 0:e.yaw):0}),L=_(()=>{const e=r.lastHeartbeat;return e?`${oo(e??0,{includeSeconds:!0})} ago`:"never"}),{history:R}=_e(h);(oe=navigator==null?void 0:navigator.geolocation)==null||oe.watchPosition(e=>n.value=[e.coords.latitude,e.coords.longitude],e=>console.error(`Failed to get position: (${e.code}) ${e.message}`),{enableHighAccuracy:!1,timeout:5e3,maximumAge:0});let D=!0;y([n,t],async()=>{n.value===b.value||!t.value||!D||(d.goToTarget(M.HOME),D=!1)});const k=g();y(r.coordinates,()=>{if(!(!t.value||!h.value)){if(k.value===void 0){k.value=m.marker(h.value);let e=no;r.vehicleType===ie.MAV_TYPE_SURFACE_BOAT?e=to:r.vehicleType===ie.MAV_TYPE_SUBMARINE&&(e=ao);const o=new m.Icon({iconUrl:e,iconSize:[64,64],iconAnchor:[32,32]});k.value.setIcon(o);const a=m.tooltip({content:"No data available",className:"waypoint-tooltip",offset:[64,-12]});k.value.bindTooltip(a),t.value.addLayer(k.value)}k.value.setLatLng(h.value)}}),y([h,N,L,()=>r.isArmed],()=>{var e,o,a,u;k.value!==void 0&&((u=k.value.getTooltip())==null||u.setContent(`
    <p>Coordinates: ${(e=h.value)==null?void 0:e[0].toFixed(6)}, ${(o=h.value)==null?void 0:o[1].toFixed(6)}</p>
    <p>Velocity: ${((a=r.velocity.ground)==null?void 0:a.toFixed(2))??"N/A"} m/s</p>
    <p>Heading: ${N.value.toFixed(2)}°</p>
    <p>${r.isArmed?"Armed":"Disarmed"}</p>
    <p>Last seen: ${L.value}</p>
  `),k.value.setRotationAngle(N.value))});const V=g();y(n,()=>{if(t.value===void 0)return;const e=n.value;if(e!==void 0){if(V.value===void 0){V.value=m.marker(e);const o=m.divIcon({className:"marker-icon",iconSize:[32,32],iconAnchor:[16,16],html:"H"});V.value.setIcon(o);const a=m.tooltip({content:"No data available",className:"waypoint-tooltip"});V.value.bindTooltip(a),t.value.addLayer(V.value)}V.value.setLatLng(n.value)}});const X=g();y(f.currentPlanningWaypoints,e=>{if(t.value!==void 0){if(X.value===void 0){const o=e.map(a=>a.coordinates);X.value=m.polyline(o,{color:"#358AC3"}).addTo(t.value)}X.value.setLatLngs(e.map(o=>o.coordinates)),e.forEach((o,a)=>{var w;const u=m.marker(o.coordinates),S=m.divIcon({className:"marker-icon",iconSize:[32,32],iconAnchor:[16,16],html:`${a}`});u.setIcon(S),(w=t.value)==null||w.addLayer(u)})}});const W=g();y(R,e=>{if(t.value===void 0||e===void 0)return;W.value===void 0&&(W.value=m.polyline([],{color:"#358AC3"}).addTo(t.value));const o=e.filter(a=>a.snapshot!==void 0).map(a=>a.snapshot);W.value.setLatLngs(o)});const H=g(!1),E=g(null),z=Le({top:"0px",left:"0px"}),O=g(),J=e=>{var o,a,u,S;if(O.value!==void 0&&t.value!==void 0&&((o=O.value)==null||o.removeFrom(t.value)),((a=e==null?void 0:e.latlng)==null?void 0:a.lat)!=null&&((u=e==null?void 0:e.latlng)==null?void 0:u.lng)!=null){E.value=[e.latlng.lat,e.latlng.lng],H.value=!0;const w=(S=t.value)==null?void 0:S.getContainer();if(w){const{x:j,y:Z}=w.getBoundingClientRect();z.left=`${e.originalEvent.clientX-j}px`,z.top=`${e.originalEvent.clientY-Z}px`}}else console.error("Invalid event structure:",e);if(t.value!==void 0){O.value=m.marker(E.value);const w=m.divIcon({className:"marker-icon",iconSize:[32,32],iconAnchor:[16,16]});O.value.setIcon(w),t.value.addLayer(O.value)}},fe=e=>{switch(console.debug(`Map context menu option selected: ${e}.`),e){case"goto":if(E.value){const w=r.coordinates.altitude??0,j=E.value[0],Z=E.value[1];je(()=>{r.goTo(0,0,0,0,j,Z,w)},{command:"GoTo"},Ze(Ge.GOTO))}break;default:console.warn("Unknown menu option selected:",e)}H.value=!1},Q=()=>{H.value=!1,E.value=null,t.value!==void 0&&O.value!==void 0&&t.value.removeLayer(O.value)},ee=e=>{e.key==="Escape"&&Q()},Y=g(!1),q=g(0),pe=async()=>{for(Y.value=!0,q.value=0;f.currentPlanningWaypoints.length>0;)f.currentPlanningWaypoints.pop();const e=async o=>{q.value=o};try{(await r.fetchMission(e)).forEach(a=>{f.currentPlanningWaypoints.push(a),ce.fire({icon:"success",title:"Mission download succeed!",timer:2e3})})}catch(o){ce.fire({icon:"error",title:"Mission download failed",text:o,timer:5e3})}finally{Y.value=!1}},ge=()=>{r.startMission()},he=Re(),be=_(()=>`${Math.max(-he.widgetClearanceForVisibleArea(l.value).bottom,0)}px`);return(e,o)=>{const a=He("tooltip");return G(),le(qe,null,[U("div",io,[U("div",{id:I.value,ref_key:"map",ref:t,class:"map"},[se(x($,{class:re(["absolute left-0 m-3 bottom-button bg-slate-50",n.value?"":"active-events-on-disabled"]),color:c.value==p(M).HOME?"red":"",elevation:"2",style:{"z-index":"1002","border-radius":"0px"},icon:"mdi-home-map-marker",size:"x-small",disabled:!n.value,onClick:o[0]||(o[0]=C(u=>p(d).goToTarget(p(M).HOME,!0),["stop"])),onDblclick:o[1]||(o[1]=C(u=>p(d).follow(p(M).HOME),["stop"]))},null,8,["class","color","disabled"]),[[a,n.value?void 0:"Home position is currently undefined"]]),se(x($,{class:re(["absolute m-3 bottom-button left-10 bg-slate-50",h.value?"":"active-events-on-disabled"]),color:c.value==p(M).VEHICLE?"red":"",elevation:"2",style:{"z-index":"1002","border-radius":"0px"},icon:"mdi-airplane-marker",size:"x-small",disabled:!h.value,onClick:o[2]||(o[2]=C(u=>p(d).goToTarget(p(M).VEHICLE,!0),["stop"])),onDblclick:o[3]||(o[3]=C(u=>p(d).follow(p(M).VEHICLE),["stop"]))},null,8,["class","color","disabled"]),[[a,h.value?void 0:"Vehicle position is currently undefined"]]),x($,{class:"absolute m-3 bottom-button left-20 bg-slate-50",elevation:"2",style:{"z-index":"1002","border-radius":"0px"},icon:"mdi-download",size:"x-small",onClick:C(pe,["stop"])}),x($,{class:"absolute mb-3 ml-1 bottom-button left-32 bg-slate-50",elevation:"2",style:{"z-index":"1002","border-radius":"0px"},icon:"mdi-play",size:"x-small",onClick:C(ge,["stop"])})],8,lo)]),H.value?(G(),le("div",{key:0,class:"context-menu",style:ze({top:z.top,left:z.left})},[U("ul",{onClick:o[5]||(o[5]=C(()=>{},["stop"]))},[U("li",{onClick:o[4]||(o[4]=u=>fe("goto"))},"GoTo")])],4)):ue("",!0),x(Xe,{modelValue:p(l).managerVars.configMenuOpen,"onUpdate:modelValue":o[7]||(o[7]=u=>p(l).managerVars.configMenuOpen=u),width:"auto"},{default:F(()=>[x(Pe,{class:"pa-2"},{default:F(()=>[x(Ue,null,{default:F(()=>[$e("Map widget settings")]),_:1}),x(Fe,null,{default:F(()=>[x(Be,{modelValue:p(l).options.showVehiclePath,"onUpdate:modelValue":o[6]||(o[6]=u=>p(l).options.showVehiclePath=u),class:"my-1",label:"Show vehicle path",color:p(l).options.showVehiclePath?"rgb(0, 20, 80)":void 0,"hide-details":""},null,8,["modelValue","color"])]),_:1})]),_:1})]),_:1},8,["modelValue"]),Y.value?(G(),We(Ye,{key:1,"model-value":q.value,height:"10",absolute:"",bottom:"",color:"#358AC3"},null,8,["model-value"])):ue("",!0)],64)}}});export{ro as default};