import{d as D,u as T,a as B,w as i,A as v,b as f,c as C,e as E,r as _,o as j,f as H,h as L,i as N,j as b,k as M,l as U,m as u,n as m,p as t,t as o,F as $,q as z,s as F,v as I,x as q,y as O,z as P,_ as R}from"./index-CiN3GnNz.js";const G=D("vehicle-alerter",()=>{const s=T(),e=B();i(s.statusText,()=>{s.statusText.text&&e.pushAlert(new v(s.statusText.severity,s.statusText.text))}),i(()=>s.mode,()=>e.pushAlert(new v(f.Info,`Vehicle mode changed to ${s.mode}.`))),i(()=>s.isArmed,l=>{const n=l?"armed":"disarmed";e.pushAlert(new v(f.Info,`Vehicle ${n}`))}),i(()=>s.isVehicleOnline,l=>{const n=l?f.Success:f.Error,a=l?"connected":"disconnected";e.pushAlert(new v(n,`Vehicle ${a}`))})}),J={class:"mx-1 my-1.5 w-[500px]"},K={class:"mx-1 overflow-hidden text-xl font-medium text-gray-100 text-ellipsis"},Q={class:"flex flex-col justify-center mx-1 font-mono text-xs font-semibold leading-3 text-right text-gray-100"},W={class:"flex items-center justify-between whitespace-nowrap"},X={class:"mx-1 overflow-hidden text-lg font-medium leading-none text-ellipsis"},Y={class:"flex flex-col justify-center mx-1 font-mono text-xs font-semibold leading-3 text-right text-gray-100"},Z={key:0,class:"h-px mx-1 mb-2 bg-slate-50/30"},ee=10,te=C({__name:"Alerter",setup(s){G();const e=B(),l=E({interval:1e3}),n=r=>P(r,"HH:mm:ss"),a=_(e.alerts[0]);let g;j(()=>{g=setInterval(()=>{var p;const r=new Date(l.value);if(H(r,((p=e.alerts.last())==null?void 0:p.time_created)||r)>ee){a.value=new v(f.Info,"No recent alerts.");return}a.value=e.alerts.last()},1e3)}),L(()=>{clearInterval(g)});const[x,h]=N(),A=_(),w=b(A),y=_(),S=b(y);i(w,(r,c)=>{c&&!r&&setTimeout(()=>{!S.value&&!w.value&&x.value&&h()},250),!x.value&&h()}),i(S,(r,c)=>{c&&!r&&h()});const V=M(()=>[...e.sortedAlerts].reverse());return(r,c)=>{const p=U("tooltip");return u(),m("div",J,[t("div",{ref_key:"currentAlertBar",ref:A,class:"flex items-center justify-between p-1 overflow-hidden rounded cursor-pointer select-none whitespace-nowrap bg-slate-800/75"},[t("p",K,o(a.value.message),1),t("div",Q,[t("p",null,o(n(a.value.time_created||new Date)),1),t("p",null,o(a.value.level.toUpperCase()),1)])],512),t("div",{ref_key:"expandedAlertsBar",ref:y,class:O(["expanded-alerts-bar absolute w-full p-2 transition-all rounded top-12 max-h-[30vh] overflow-y-auto text-slate-50 scrollbar-hide bg-slate-800/75 select-none flex flex-col",{"opacity-0 invisible":!I(x)}])},[(u(!0),m($,null,z(V.value,(d,k)=>(u(),m("div",{key:d.time_created.toISOString()},[F((u(),m("div",W,[t("p",X,o(d.message),1),t("div",Y,[t("p",null,o(n(d.time_created||new Date)),1),t("p",null,o(d.level.toUpperCase()),1)])])),[[p,d.message,void 0,{right:!0}]]),k!==I(e).alerts.length-1?(u(),m("div",Z)):q("",!0)]))),128))],2)])}}}),re=R(te,[["__scopeId","data-v-1eec6a2c"]]);export{re as default};