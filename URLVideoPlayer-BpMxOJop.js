import{c as g,b7 as v,s as e,J as w,Q as x,S as b,r as S,w as C,W as _,l as p,m,n as i,G as a,$ as s,ad as h,a4 as M,ae as U,a0 as f,af as k,ag as B,b9 as I,ai as O,bt as d,ba as P,a6 as T,a7 as A,a9 as E,aa as L,_ as N}from"./index-DtiwbPVE.js";const V=n=>(E("data-v-ab1e6b49"),n=n(),L(),n),R={class:"w-full h-full"},j=["autoplay","controls","loop","muted"],D=["src"],F=V(()=>i("a",null,"Video Source",-1)),G=V(()=>i("span",{class:"text-xs font-semibold leading-3 text-slate-600"},"Fit style",-1)),K=g({__name:"URLVideoPlayer",props:{widget:{}},setup(n){v(y=>({d4904f84:e(o).options.fitStyle}));const c=w(),u=x(),o=b(n).widget,r=S();return C(o.value.options,()=>{r.value.pause(),r.value.play()}),_(()=>{Object.keys(o.value.options).length===0&&(o.value.options={source:"",fitStyle:"cover",autoplay:!0,controls:!0,loop:!0,muted:!0})}),(y,t)=>(p(),m("div",R,[(p(),m("video",{ref_key:"videoPlayer",ref:r,key:e(o).options.source,autoplay:e(o).options.autoplay,controls:e(o).options.controls,loop:e(o).options.loop,muted:e(o).options.muted},[i("source",{src:e(o).options.source},null,8,D)],8,j)),a(A,{modelValue:e(u).widgetManagerVars(e(o).hash).configMenuOpen,"onUpdate:modelValue":t[8]||(t[8]=l=>e(u).widgetManagerVars(e(o).hash).configMenuOpen=l),"min-width":"400","max-width":"35%"},{default:s(()=>[a(h,{class:"pa-2",style:M(e(c).globalGlassMenuStyles)},{default:s(()=>[a(U,{class:"text-center"},{default:s(()=>[f("Video Source")]),_:1}),a(k,null,{default:s(()=>[F,a(B,{variant:"filled","model-value":e(o).options.source,outlined:"",onChange:t[0]||(t[0]=l=>e(o).options.source=l.srcElement.value),onKeydown:t[1]||(t[1]=I(l=>e(o).options.source=l.srcElement.value,["enter"]))},null,8,["model-value"]),i("div",null,[G,a(O,{modelValue:e(o).options.fitStyle,"onUpdate:modelValue":t[2]||(t[2]=l=>e(o).options.fitStyle=l),options:["cover","fill","contain"],variant:"outlined",class:"max-w-[144px]"},null,8,["modelValue"]),a(d,{modelValue:e(o).options.autoplay,"onUpdate:modelValue":t[3]||(t[3]=l=>e(o).options.autoplay=l),label:"Autoplay","hide-details":""},null,8,["modelValue"]),a(d,{modelValue:e(o).options.controls,"onUpdate:modelValue":t[4]||(t[4]=l=>e(o).options.controls=l),label:"Controls","hide-details":""},null,8,["modelValue"]),a(d,{modelValue:e(o).options.loop,"onUpdate:modelValue":t[5]||(t[5]=l=>e(o).options.loop=l),label:"Loop","hide-details":""},null,8,["modelValue"]),a(d,{modelValue:e(o).options.muted,"onUpdate:modelValue":t[6]||(t[6]=l=>e(o).options.muted=l),label:"Muted","hide-details":""},null,8,["modelValue"])])]),_:1}),a(P,{class:"flex justify-end"},{default:s(()=>[a(T,{color:"white",onClick:t[7]||(t[7]=l=>e(u).widgetManagerVars(e(o).hash).configMenuOpen=!1)},{default:s(()=>[f(" Close ")]),_:1})]),_:1})]),_:1},8,["style"])]),_:1},8,["modelValue"])]))}}),z=N(K,[["__scopeId","data-v-ab1e6b49"]]);export{z as default};