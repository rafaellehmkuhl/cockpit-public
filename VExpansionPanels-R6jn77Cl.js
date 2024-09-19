import{aE as P,aF as g,aG as L,aH as b,aI as C,aJ as $,aK as m,G as l,q as T,aL as j,aM as z,aN as k,aO as F,aP as N,aQ as h,aR as O,k as v,aS as q,aT as w,a1 as H,aU as J,aV as K,aW as M,aX as _,aY as Q,aZ as U,a_ as W,a$ as X,b0 as Y,b1 as Z,b2 as ee,b3 as ae,b4 as ne,b5 as le,b6 as t}from"./index-DtiwbPVE.js";const p=Symbol.for("vuetify:v-expansion-panel"),A=P({...g(),...L()},"VExpansionPanelText"),S=b()({name:"VExpansionPanelText",props:A(),setup(e,d){let{slots:n}=d;const a=C(p);if(!a)throw new Error("[Vuetify] v-expansion-panel-text needs to be placed inside v-expansion-panel");const{hasContent:o,onAfterLeave:u}=$(e,a.isSelected);return m(()=>l(z,{onAfterLeave:u},{default:()=>{var i;return[T(l("div",{class:["v-expansion-panel-text",e.class],style:e.style},[n.default&&o.value&&l("div",{class:"v-expansion-panel-text__wrapper"},[(i=n.default)==null?void 0:i.call(n)])]),[[j,a.isSelected.value]])]}})),{}}}),B=P({color:String,expandIcon:{type:k,default:"$expand"},collapseIcon:{type:k,default:"$collapse"},hideActions:Boolean,focusable:Boolean,static:Boolean,ripple:{type:[Boolean,Object],default:!1},readonly:Boolean,...g(),...F()},"VExpansionPanelTitle"),I=b()({name:"VExpansionPanelTitle",directives:{Ripple:N},props:B(),setup(e,d){let{slots:n}=d;const a=C(p);if(!a)throw new Error("[Vuetify] v-expansion-panel-title needs to be placed inside v-expansion-panel");const{backgroundColorClasses:o,backgroundColorStyles:u}=h(e,"color"),{dimensionStyles:i}=O(e),r=v(()=>({collapseIcon:e.collapseIcon,disabled:a.disabled.value,expanded:a.isSelected.value,expandIcon:e.expandIcon,readonly:e.readonly})),y=v(()=>a.isSelected.value?e.collapseIcon:e.expandIcon);return m(()=>{var x;return T(l("button",{class:["v-expansion-panel-title",{"v-expansion-panel-title--active":a.isSelected.value,"v-expansion-panel-title--focusable":e.focusable,"v-expansion-panel-title--static":e.static},o.value,e.class],style:[u.value,i.value,e.style],type:"button",tabindex:a.disabled.value?-1:void 0,disabled:a.disabled.value,"aria-expanded":a.isSelected.value,onClick:e.readonly?void 0:a.toggle},[l("span",{class:"v-expansion-panel-title__overlay"},null),(x=n.default)==null?void 0:x.call(n,r.value),!e.hideActions&&l(w,{defaults:{VIcon:{icon:y.value}}},{default:()=>{var f;return[l("span",{class:"v-expansion-panel-title__icon"},[((f=n.actions)==null?void 0:f.call(n,r.value))??l(H,null,null)])]}})]),[[q("ripple"),e.ripple]])}),{}}}),D=P({title:String,text:String,bgColor:String,...J(),...K(),...M(),..._(),...B(),...A()},"VExpansionPanel"),ie=b()({name:"VExpansionPanel",props:D(),emits:{"group:selected":e=>!0},setup(e,d){let{slots:n}=d;const a=Q(e,p),{backgroundColorClasses:o,backgroundColorStyles:u}=h(e,"bgColor"),{elevationClasses:i}=U(e),{roundedClasses:r}=W(e),y=v(()=>(a==null?void 0:a.disabled.value)||e.disabled),x=v(()=>a.group.items.value.reduce((c,s,V)=>(a.group.selected.value.includes(s.id)&&c.push(V),c),[])),f=v(()=>{const c=a.group.items.value.findIndex(s=>s.id===a.id);return!a.isSelected.value&&x.value.some(s=>s-c===1)}),G=v(()=>{const c=a.group.items.value.findIndex(s=>s.id===a.id);return!a.isSelected.value&&x.value.some(s=>s-c===-1)});return X(p,a),m(()=>{const c=!!(n.text||e.text),s=!!(n.title||e.title),V=I.filterProps(e),R=S.filterProps(e);return l(e.tag,{class:["v-expansion-panel",{"v-expansion-panel--active":a.isSelected.value,"v-expansion-panel--before-active":f.value,"v-expansion-panel--after-active":G.value,"v-expansion-panel--disabled":y.value},r.value,o.value,e.class],style:[u.value,e.style]},{default:()=>[l("div",{class:["v-expansion-panel__shadow",...i.value]},null),l(w,{defaults:{VExpansionPanelTitle:{...V},VExpansionPanelText:{...R}}},{default:()=>{var E;return[s&&l(I,{key:"title"},{default:()=>[n.title?n.title():e.title]}),c&&l(S,{key:"text"},{default:()=>[n.text?n.text():e.text]}),(E=n.default)==null?void 0:E.call(n)]}})]})}),{groupItem:a}}}),te=["default","accordion","inset","popout"],se=P({flat:Boolean,...Y(),...Z(D(),["bgColor","collapseIcon","color","eager","elevation","expandIcon","focusable","hideActions","readonly","ripple","rounded","tile","static"]),...ee(),...g(),..._(),variant:{type:String,default:"default",validator:e=>te.includes(e)}},"VExpansionPanels"),ce=b()({name:"VExpansionPanels",props:se(),emits:{"update:modelValue":e=>!0},setup(e,d){let{slots:n}=d;const{next:a,prev:o}=ae(e,p),{themeClasses:u}=ne(e),i=v(()=>e.variant&&`v-expansion-panels--variant-${e.variant}`);return le({VExpansionPanel:{bgColor:t(e,"bgColor"),collapseIcon:t(e,"collapseIcon"),color:t(e,"color"),eager:t(e,"eager"),elevation:t(e,"elevation"),expandIcon:t(e,"expandIcon"),focusable:t(e,"focusable"),hideActions:t(e,"hideActions"),readonly:t(e,"readonly"),ripple:t(e,"ripple"),rounded:t(e,"rounded"),static:t(e,"static")}}),m(()=>l(e.tag,{class:["v-expansion-panels",{"v-expansion-panels--flat":e.flat,"v-expansion-panels--tile":e.tile},u.value,i.value,e.class],style:e.style},{default:()=>{var r;return[(r=n.default)==null?void 0:r.call(n,{prev:o,next:a})]}})),{next:a,prev:o}}});export{ce as V,ie as a,I as b,S as c};