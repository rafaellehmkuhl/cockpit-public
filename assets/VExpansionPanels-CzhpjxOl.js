import{aY as f,aZ as g,a_ as L,a$ as P,b0 as C,b1 as $,b2 as m,H as l,G as h,aR as j,b3 as z,b4 as k,b5 as F,b6 as H,b7 as T,b8 as N,k as v,b9 as O,ba as w,ae as Y,bb as Z,bc as q,bd as J,be as _,bf as K,bg as M,bh as Q,bi as U,bj as W,bk as X,bl as ee,bm as ae,bn as ne,bo as le,bp as t}from"./index-Bd_7J4aa.js";const p=Symbol.for("vuetify:v-expansion-panel"),A=f({...g(),...L()},"VExpansionPanelText"),S=P()({name:"VExpansionPanelText",props:A(),setup(e,d){let{slots:n}=d;const a=C(p);if(!a)throw new Error("[Vuetify] v-expansion-panel-text needs to be placed inside v-expansion-panel");const{hasContent:o,onAfterLeave:u}=$(e,a.isSelected);return m(()=>l(z,{onAfterLeave:u},{default:()=>{var i;return[h(l("div",{class:["v-expansion-panel-text",e.class],style:e.style},[n.default&&o.value&&l("div",{class:"v-expansion-panel-text__wrapper"},[(i=n.default)==null?void 0:i.call(n)])]),[[j,a.isSelected.value]])]}})),{}}}),B=f({color:String,expandIcon:{type:k,default:"$expand"},collapseIcon:{type:k,default:"$collapse"},hideActions:Boolean,focusable:Boolean,static:Boolean,ripple:{type:[Boolean,Object],default:!1},readonly:Boolean,...g(),...F()},"VExpansionPanelTitle"),I=P()({name:"VExpansionPanelTitle",directives:{Ripple:H},props:B(),setup(e,d){let{slots:n}=d;const a=C(p);if(!a)throw new Error("[Vuetify] v-expansion-panel-title needs to be placed inside v-expansion-panel");const{backgroundColorClasses:o,backgroundColorStyles:u}=T(e,"color"),{dimensionStyles:i}=N(e),r=v(()=>({collapseIcon:e.collapseIcon,disabled:a.disabled.value,expanded:a.isSelected.value,expandIcon:e.expandIcon,readonly:e.readonly})),y=v(()=>a.isSelected.value?e.collapseIcon:e.expandIcon);return m(()=>{var x;return h(l("button",{class:["v-expansion-panel-title",{"v-expansion-panel-title--active":a.isSelected.value,"v-expansion-panel-title--focusable":e.focusable,"v-expansion-panel-title--static":e.static},o.value,e.class],style:[u.value,i.value,e.style],type:"button",tabindex:a.disabled.value?-1:void 0,disabled:a.disabled.value,"aria-expanded":a.isSelected.value,onClick:e.readonly?void 0:a.toggle},[l("span",{class:"v-expansion-panel-title__overlay"},null),(x=n.default)==null?void 0:x.call(n,r.value),!e.hideActions&&l(w,{defaults:{VIcon:{icon:y.value}}},{default:()=>{var b;return[l("span",{class:"v-expansion-panel-title__icon"},[((b=n.actions)==null?void 0:b.call(n,r.value))??l(Y,null,null)])]}})]),[[O("ripple"),e.ripple]])}),{}}}),D=f({title:String,text:String,bgColor:String,...Z(),...q(),...J(),..._(),...B(),...A()},"VExpansionPanel"),ie=P()({name:"VExpansionPanel",props:D(),emits:{"group:selected":e=>!0},setup(e,d){let{slots:n}=d;const a=K(e,p),{backgroundColorClasses:o,backgroundColorStyles:u}=T(e,"bgColor"),{elevationClasses:i}=M(e),{roundedClasses:r}=Q(e),y=v(()=>(a==null?void 0:a.disabled.value)||e.disabled),x=v(()=>a.group.items.value.reduce((c,s,V)=>(a.group.selected.value.includes(s.id)&&c.push(V),c),[])),b=v(()=>{const c=a.group.items.value.findIndex(s=>s.id===a.id);return!a.isSelected.value&&x.value.some(s=>s-c===1)}),R=v(()=>{const c=a.group.items.value.findIndex(s=>s.id===a.id);return!a.isSelected.value&&x.value.some(s=>s-c===-1)});return U(p,a),m(()=>{const c=!!(n.text||e.text),s=!!(n.title||e.title),V=I.filterProps(e),G=S.filterProps(e);return l(e.tag,{class:["v-expansion-panel",{"v-expansion-panel--active":a.isSelected.value,"v-expansion-panel--before-active":b.value,"v-expansion-panel--after-active":R.value,"v-expansion-panel--disabled":y.value},r.value,o.value,e.class],style:[u.value,e.style]},{default:()=>[l("div",{class:["v-expansion-panel__shadow",...i.value]},null),l(w,{defaults:{VExpansionPanelTitle:{...V},VExpansionPanelText:{...G}}},{default:()=>{var E;return[s&&l(I,{key:"title"},{default:()=>[n.title?n.title():e.title]}),c&&l(S,{key:"text"},{default:()=>[n.text?n.text():e.text]}),(E=n.default)==null?void 0:E.call(n)]}})]})}),{groupItem:a}}}),te=["default","accordion","inset","popout"],se=f({flat:Boolean,...W(),...X(D(),["bgColor","collapseIcon","color","eager","elevation","expandIcon","focusable","hideActions","readonly","ripple","rounded","tile","static"]),...ee(),...g(),..._(),variant:{type:String,default:"default",validator:e=>te.includes(e)}},"VExpansionPanels"),ce=P()({name:"VExpansionPanels",props:se(),emits:{"update:modelValue":e=>!0},setup(e,d){let{slots:n}=d;const{next:a,prev:o}=ae(e,p),{themeClasses:u}=ne(e),i=v(()=>e.variant&&`v-expansion-panels--variant-${e.variant}`);return le({VExpansionPanel:{bgColor:t(e,"bgColor"),collapseIcon:t(e,"collapseIcon"),color:t(e,"color"),eager:t(e,"eager"),elevation:t(e,"elevation"),expandIcon:t(e,"expandIcon"),focusable:t(e,"focusable"),hideActions:t(e,"hideActions"),readonly:t(e,"readonly"),ripple:t(e,"ripple"),rounded:t(e,"rounded"),static:t(e,"static")}}),m(()=>l(e.tag,{class:["v-expansion-panels",{"v-expansion-panels--flat":e.flat,"v-expansion-panels--tile":e.tile},u.value,i.value,e.class],style:e.style},{default:()=>{var r;return[(r=n.default)==null?void 0:r.call(n,{prev:o,next:a})]}})),{next:a,prev:o}}});export{ce as V,ie as a,I as b,S as c};