import{c as K,P as ee,J as te,Q as ae,R as se,S as oe,r as f,U as ne,V as ie,e as re,k as M,w,o as le,W as de,X as ce,Y as ue,Z as ve,D as me,l as r,m as c,n as v,x as E,s as n,G as u,$ as h,a0 as k,a1 as F,F as L,t as z,H as q,v as G,a2 as ge,a3 as pe,a4 as fe,a5 as he,a6 as H,a7 as ye,a8 as Se,a9 as we,aa as xe,_ as be}from"./index-DtiwbPVE.js";const C=x=>(we("data-v-9e050316"),x=x(),xe(),x),Ve={key:1},_e={class:"text-xs text-white select-none scroll-text"},ke={key:3,class:"w-16 text-justify text-slate-100"},Me={key:4,class:"w-16 text-justify text-slate-100"},Fe=C(()=>v("div",{class:"text-xs text-center text-white select-none flex-nowrap"},"Processing video...",-1)),Ce=[Fe],Re={class:"flex justify-center w-6"},Ie=C(()=>v("p",{class:"text-xl font-semibold m-4"},"Choose a stream to record",-1)),Ne={class:"flex w-full justify-between items-center mt-4"},We=C(()=>v("span",null,"Record",-1)),Oe={key:1,class:"w-5 h-5 ml-2 rounded-full bg-red"},De=K({__name:"MiniVideoRecorder",props:{miniWidget:{}},setup(x){const{showDialog:y}=ee(),R=te(),m=ae(),s=se(),a=oe(x).miniWidget,o=f(),{namessAvailableAbstractedStreams:V}=ne(s),I=f(),{isOutside:N}=ie(I),W=f(!1),S=f(!1),Y=re({interval:100}),g=f(),b=f(!1),O=f(0),i=M(()=>o.value?s.externalStreamId(o.value):void 0),D=()=>{R.videoLibraryVisibility=!0};w(()=>s.streamsCorrespondency,()=>g.value=void 0,{deep:!0}),le(async()=>{await _()}),de(async()=>{Object.keys(a.value.options).length===0&&(a.value.options={internalStreamName:void 0}),o.value=a.value.options.internalStreamName}),w(o,()=>{a.value.options.internalStreamName=o.value,g.value=void 0});const _=async()=>{const t=(await s.videoStoringDB.keys()).filter(l=>s.isVideoFilename(l)).length,e=Object.keys(s.keysFailedUnprocessedVideos).length;O.value=t+e};function B(t){if(o.value=t,o.value===void 0){y({message:"No stream selected.",variant:"error"});return}if(V.value.includes(o.value))return;const e="The selected stream is not available. Please check its source or select another stream.";throw y({message:e,variant:"error"}),new Error(e)}const J=async()=>{if(p.value){i.value!==void 0&&s.stopRecording(i.value);return}if(o.value===void 0){m.miniWidgetManagerVars(a.value.hash).configMenuOpen=!0;return}$()},$=()=>{var t;if(i.value===void 0){y({title:"Cannot start recording.",message:"No stream selected.",variant:"error"});return}if(!((t=s.getStreamData(i.value))!=null&&t.connected)){y({title:"Cannot start recording.",message:"Stream is not connected.",variant:"error"});return}B(o.value),s.startRecording(i.value),m.miniWidgetManagerVars(a.value.hash).configMenuOpen=!1},p=M(()=>i.value===void 0?!1:s.isRecording(i.value)),Q=M(()=>{var A,P,T,U;if(i.value===void 0)return"00:00:00";const t=(A=s.getStreamData(i.value))==null?void 0:A.timeRecordingStart;if(t===void 0)return"00:00:00";const e=ce({start:t,end:Y.value}),l=((P=e.hours)==null?void 0:P.toFixed(0).length)===1?`0${e.hours}`:e.hours,d=((T=e.minutes)==null?void 0:T.toFixed(0).length)===1?`0${e.minutes}`:e.minutes,Z=((U=e.seconds)==null?void 0:U.toFixed(0).length)===1?`0${e.seconds}`:e.seconds;return`${l}:${d}:${Z}`}),X=async t=>{B(t),g.value=void 0,S.value=!0;let e=0;const l=100,d=3e3;for(;S.value&&e<d;)S.value=g.value===void 0||!g.value.active,await Se(l),e+=l;if(S.value){y({message:"Could not load media stream.",variant:"error"});return}a.value.options.internalStreamName=t};let j;return m.isRealMiniWidget(a.value)&&(j=setInterval(()=>{if(a.value.options.internalStreamName===void 0&&!V.value.isEmpty()&&(a.value.options.internalStreamName=V.value[0],o.value=a.value.options.internalStreamName),i.value!==void 0){const t=s.getMediaStream(a.value.options.internalStreamName);ue(t,g.value)||(g.value=t)}},1e3)),ve(()=>clearInterval(j)),w(()=>s.areThereVideosProcessing,t=>{b.value=t,_()}),w(()=>s.keysFailedUnprocessedVideos,()=>_()),w(()=>W.value,async t=>{t===!1&&await _()}),w(p,()=>{if(!p.value){window.onbeforeunload=null;return}window.onbeforeunload=()=>(y({message:`
      You have a video recording ongoing.
      Remember to stop it before closing Cockpit, or the record will be lost.
    `,variant:"warning"}),"I hope the user does not click on the leave button.")}),(t,e)=>{const l=me("FontAwesomeIcon");return r(),c(L,null,[v("div",{ref_key:"recorderWidget",ref:I,class:"flex justify-around px-2 py-1 text-center rounded-lg w-40 h-9 align-center bg-slate-800/60"},[b.value?(r(),c("div",Ve,[u(F,{class:"w-6 h-6 animate-spin",color:"white"},{default:h(()=>[k("mdi-loading")]),_:1})])):(r(),c("div",{key:0,class:E([{"blob red w-5 opacity-100 rounded-sm":p.value,"opacity-30 bg-red-400":n(N)&&!p.value},"w-6 transition-all duration-500 rounded-full aspect-square bg-red-lighten-1 hover:cursor-pointer opacity-70 hover:opacity-90"]),onClick:e[0]||(e[0]=d=>J())},null,2)),!p.value&&!b.value?(r(),c(L,{key:2},[o.value?(r(),c("div",{key:0,class:"flex flex-col max-w-[50%] scroll-container transition-all border-blur cursor-pointer",onClick:e[1]||(e[1]=d=>n(m).miniWidgetManagerVars(n(a).hash).configMenuOpen=!0)},[v("div",_e,z(o.value),1)])):(r(),q(l,{key:1,icon:"fa-solid fa-video",class:"h-6 text-slate-100"}))],64)):G("",!0),p.value&&!b.value?(r(),c("div",ke,z(Q.value),1)):b.value?(r(),c("div",Me,Ce)):G("",!0),v("div",Re,[u(ge,{vertical:"",class:"h-6 ml-1"}),u(pe,{color:"info",content:O.value,dot:n(N)||W.value,class:"cursor-pointer",onClick:D},{default:h(()=>[u(F,{class:"w-6 h-6 ml-1 text-slate-100",onClick:D},{default:h(()=>[k(" mdi-video-box ")]),_:1})]),_:1},8,["content","dot"])])],512),u(ye,{modelValue:n(m).miniWidgetManagerVars(n(a).hash).configMenuOpen,"onUpdate:modelValue":e[3]||(e[3]=d=>n(m).miniWidgetManagerVars(n(a).hash).configMenuOpen=d),width:"auto"},{default:h(()=>[v("div",{class:"flex flex-col items-center p-2 pt-1 m-5 rounded-md gap-y-4",style:fe(n(R).globalGlassMenuStyles)},[Ie,u(he,{"model-value":o.value,label:"Stream name",items:n(V),"item-title":"name",density:"compact",variant:"outlined","no-data-text":"No streams available.","hide-details":"","return-object":"",theme:"dark",class:"w-[90%]","onUpdate:modelValue":X},null,8,["model-value","items"]),v("div",Ne,[u(H,{class:"w-auto text-uppercase",variant:"text",onClick:e[2]||(e[2]=d=>n(m).miniWidgetManagerVars(n(a).hash).configMenuOpen=!1)},{default:h(()=>[k(" Cancel ")]),_:1}),u(H,{class:E(["bg-[#FFFFFF11] hover:bg-[#FFFFFF33]",{"opacity-30 pointer-events-none":S.value}]),size:"large",onClick:$},{default:h(()=>[We,S.value?(r(),q(F,{key:0,class:"m-2 animate-spin"},{default:h(()=>[k("mdi-loading")]),_:1})):(r(),c("div",Oe))]),_:1},8,["class"])])],4)]),_:1},8,["modelValue"])],64)}}}),je=be(De,[["__scopeId","data-v-9e050316"]]);export{je as default};