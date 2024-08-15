import{bw as E,c as T,ba as H,v as o,K as O,S as W,Q as L,af as q,ah as G,ag as Y,r as V,aj as K,k as y,w as x,al as Q,V as X,m as u,n as c,p as l,t as h,F as I,q as M,Z as S,H as i,W as f,a4 as Z,X as J,ar as ee,a5 as te,an as $,aG as C,a2 as F,aa as ae,ad as oe,ae as le,_ as ne}from"./index-DMKCtSC0.js";const se=E("v-banner-text"),d=g=>(oe("data-v-1948b773"),g=g(),le(),g),ie={ref:"videoWidget",class:"video-widget"},re={key:0,class:"no-video-alert"},de=d(()=>l("span",null,"No video stream selected.",-1)),ue=[de],ce={key:1,class:"no-video-alert"},pe=d(()=>l("br",null,null,-1)),ve=d(()=>l("p",null," This can happen if you changed vehicles and the stream name in the new one is different from the former, or if the source is not available at all. ",-1)),me=d(()=>l("br",null,null,-1)),fe=d(()=>l("p",null," Please open this video player configuration and select a new stream from the ones available, or check your source for issues. ",-1)),ye={key:2,class:"no-video-alert"},Se={class:"no-video-alert"},ge=d(()=>l("span",{class:"text-xl font-bold"},"Server status: ",-1)),he=d(()=>l("br",null,null,-1)),_e=d(()=>l("span",{class:"text-xl font-bold"},"Stream status: ",-1)),Ve=d(()=>l("br",null,null,-1)),be={key:3,class:"no-video-alert"},we=d(()=>l("p",null,"Loading stream...",-1)),xe=[we],Ie={class:"flex-wrap justify-center d-flex ga-5"},ke=T({__name:"VideoPlayer",props:{widget:{}},setup(g){H(n=>({"5800d814":o(e).options.videoFitStyle,"39d5fcb8":D.value}));const U=O(),{showDialog:j}=W(),r=L(),k=q(),{namessAvailableAbstractedStreams:p}=G(r),e=Y(g).widget,s=V(),_=V(),v=V(),b=V(!1);K(()=>{const n={videoFitStyle:"cover",flipHorizontally:!1,flipVertically:!1,rotationAngle:0,internalStreamName:void 0};e.value.options=Object.assign({},n,e.value.options),s.value=e.value.options.internalStreamName});const m=y(()=>s.value?r.externalStreamId(s.value):void 0);x(()=>r.streamsCorrespondency,()=>v.value=void 0,{deep:!0});const P=setInterval(()=>{var n;if(e.value.options.internalStreamName===void 0&&!p.value.isEmpty()&&(e.value.options.internalStreamName=p.value[0],s.value=e.value.options.internalStreamName,p.value.length>1&&j({maxWidth:600,title:"Multiple streams detected",message:`You have multiple streams available, so we chose one randomly to start with.
        If you want to change it, please open the widget configuration on the edit-menu.`,variant:"info"})),m.value!==void 0){const t=r.getMediaStream(m.value);Q(t,v.value)||(v.value=t);const a=((n=r.getStreamData(m.value))==null?void 0:n.connected)??!1;a!==b.value&&(b.value=a)}},1e3);X(()=>clearInterval(P)),x(s,()=>{e.value.options.internalStreamName=s.value,v.value=void 0}),x(v,()=>{!_.value||!v.value||(_.value.srcObject=v.value,_.value.play().then(()=>console.log("[VideoPlayer] Stream is playing")).catch(n=>{const t=`Failed to play stream. Reason: ${n}`;console.error(`[VideoPlayer] ${t}`)}))});const N=n=>{e.value.options.rotationAngle+=n},R=y(()=>`scale(${e.value.options.flipHorizontally?-1:1}, ${e.value.options.flipVertically?-1:1})`),A=y(()=>`rotate(${e.value.options.rotationAngle??0}deg)`),D=y(()=>`${R.value} ${A.value}`),z=y(()=>{var n;return m.value===void 0?"Unknown.":((n=r.getStreamData(m.value))==null?void 0:n.webRtcManager.signallerStatus)??"Unknown."}),B=y(()=>{var t;if(m.value===void 0)return"Unknown.";const n=r.availableIceIps;return!n.isEmpty()&&!n.find(a=>r.allowedIceIps.includes(a))?`Stream is coming from IPs [${n.join(", ")}], which are not in the list of allowed sources
      [${r.allowedIceIps.join(", ")}].\\n Please check your configuration.`:((t=r.getStreamData(m.value))==null?void 0:t.webRtcManager.streamStatus)??"Unknown."});return(n,t)=>(u(),c(I,null,[l("div",ie,[s.value===void 0?(u(),c("div",re,ue)):!o(p).isEmpty()&&!o(p).includes(s.value)?(u(),c("div",ce,[l("p",null,'The selected stream "'+h(s.value)+'" is not available.',1),l("p",null,"Available ones are: "+h(o(p).map(a=>`"${a}"`).join(", "))+".",1),pe,ve,me,fe])):b.value?(u(),c("div",be,xe)):(u(),c("div",ye,[l("div",Se,[l("p",null,[ge,(u(!0),c(I,null,M(z.value.toString().split("\\n"),(a,w)=>(u(),c("span",{key:w},[S(h(a)+" ",1),he]))),128))]),l("p",null,[_e,(u(!0),c(I,null,M(B.value.toString().split("\\n"),(a,w)=>(u(),c("span",{key:w},[S(h(a)+" ",1),Ve]))),128))])])])),l("video",{id:"mainDisplayStream",ref_key:"videoElement",ref:_,muted:"",autoplay:"",playsinline:"",disablePictureInPicture:""}," Your browser does not support the video tag. ",512)],512),i(ae,{modelValue:o(k).widgetManagerVars(o(e).hash).configMenuOpen,"onUpdate:modelValue":t[6]||(t[6]=a=>o(k).widgetManagerVars(o(e).hash).configMenuOpen=a),width:"auto"},{default:f(()=>[i(Z,{class:"pa-4 text-white",style:J([{"border-radius":"15px"},o(U).globalGlassMenuStyles])},{default:f(()=>[i(ee,{class:"text-center"},{default:f(()=>[S("Video widget config")]),_:1}),i(te,{class:"flex flex-col gap-y-4"},{default:f(()=>[i($,{modelValue:s.value,"onUpdate:modelValue":t[0]||(t[0]=a=>s.value=a),label:"Stream name",class:"my-3",items:o(p),"item-title":"name",density:"compact",variant:"outlined","no-data-text":"No streams available.","hide-details":"","return-object":""},null,8,["modelValue","items"]),i($,{modelValue:o(e).options.videoFitStyle,"onUpdate:modelValue":t[1]||(t[1]=a=>o(e).options.videoFitStyle=a),label:"Fit style",class:"my-3",items:["cover","fill","contain"],"item-title":"style",density:"compact",variant:"outlined","no-data-text":"No streams available.","hide-details":"","return-object":""},null,8,["modelValue"]),i(se,null,{default:f(()=>[S('Saved stream name: "'+h(o(e).options.internalStreamName)+'"',1)]),_:1}),i(C,{modelValue:o(e).options.flipHorizontally,"onUpdate:modelValue":t[2]||(t[2]=a=>o(e).options.flipHorizontally=a),class:"my-1",label:"Flip horizontally",color:o(e).options.flipHorizontally?"white":void 0,"hide-details":""},null,8,["modelValue","color"]),i(C,{modelValue:o(e).options.flipVertically,"onUpdate:modelValue":t[3]||(t[3]=a=>o(e).options.flipVertically=a),class:"my-1",label:"Flip vertically",color:o(e).options.flipVertically?"white":void 0,"hide-details":""},null,8,["modelValue","color"]),l("div",Ie,[i(F,{"prepend-icon":"mdi-file-rotate-left",variant:"outlined",onClick:t[4]||(t[4]=a=>N(-90))},{default:f(()=>[S(" Rotate Left")]),_:1}),i(F,{"prepend-icon":"mdi-file-rotate-right",variant:"outlined",onClick:t[5]||(t[5]=a=>N(90))},{default:f(()=>[S(" Rotate Right")]),_:1})])]),_:1})]),_:1},8,["style"])]),_:1},8,["modelValue"])],64))}}),$e=ne(ke,[["__scopeId","data-v-1948b773"]]);export{$e as default};