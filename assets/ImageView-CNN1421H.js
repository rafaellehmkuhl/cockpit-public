import{c as m,bq as g,q as s,K as V,y as c,J as w,L as x,k as v,l as y,m as C,n,H as a,N as o,V as S,O as M,P as b,Q as r,R as k,U as I,am as _,bs as B,a5 as O,W as U,_ as N}from"./index-CgS78Hik.js";const R={class:"w-full h-full"},T=["src"],L=m({__name:"ImageView",props:{widget:{}},setup(d){g(f=>({a0190c2e:s(t).options.fitStyle}));const u=V(),i=c(),t=w(d).widget;x(()=>{Object.keys(t.value.options).length===0&&(t.value.options={src:"",fitStyle:"cover"})});const p=v(()=>t.value.options.src??"");return(f,e)=>(y(),C("div",R,[n("img",{src:p.value,draggable:"false"},null,8,T),a(U,{modelValue:s(i).widgetManagerVars(s(t).hash).configMenuOpen,"onUpdate:modelValue":e[3]||(e[3]=l=>s(i).widgetManagerVars(s(t).hash).configMenuOpen=l),"min-width":"400","max-width":"35%"},{default:o(()=>[a(S,{class:"pa-2",style:M(s(u).globalGlassMenuStyles)},{default:o(()=>[a(b,{class:"text-center"},{default:o(()=>e[4]||(e[4]=[r("Image URL")])),_:1}),a(k,null,{default:o(()=>[e[6]||(e[6]=n("a",null,"Image URL",-1)),a(I,{"model-value":s(t).options.src,outlined:"",onChange:e[0]||(e[0]=l=>s(t).options.src=l.srcElement.value)},null,8,["model-value"]),n("div",null,[e[5]||(e[5]=n("span",{class:"text-xs font-semibold leading-3 text-slate-600"},"Fit style",-1)),a(_,{modelValue:s(t).options.fitStyle,"onUpdate:modelValue":e[1]||(e[1]=l=>s(t).options.fitStyle=l),options:["cover","fill","contain"],class:"max-w-[144px]",theme:"dark"},null,8,["modelValue"])])]),_:1}),a(B,{class:"flex justify-end"},{default:o(()=>[a(O,{color:"white",onClick:e[2]||(e[2]=l=>s(i).widgetManagerVars(s(t).hash).configMenuOpen=!1)},{default:o(()=>e[7]||(e[7]=[r(" Close ")])),_:1})]),_:1})]),_:1},8,["style"])]),_:1},8,["modelValue"])]))}}),A=N(L,[["__scopeId","data-v-e07f7844"]]);export{A as default};