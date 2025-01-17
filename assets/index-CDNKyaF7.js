var R={grad:.9,turn:360,rad:360/(2*Math.PI)},h=function(n){return typeof n=="string"?n.length>0:typeof n=="number"},s=function(n,t,e){return t===void 0&&(t=0),e===void 0&&(e=Math.pow(10,t)),Math.round(e*n)/e+0},d=function(n,t,e){return t===void 0&&(t=0),e===void 0&&(e=1),n>e?e:n>t?n:t},w=function(n){return(n=isFinite(n)?n%360:0)>0?n:n+360},m=function(n){return{r:d(n.r,0,255),g:d(n.g,0,255),b:d(n.b,0,255),a:d(n.a)}},c=function(n){return{r:s(n.r),g:s(n.g),b:s(n.b),a:s(n.a,3)}},q=/^#([0-9a-f]{3,8})$/i,g=function(n){var t=n.toString(16);return t.length<2?"0"+t:t},S=function(n){var t=n.r,e=n.g,r=n.b,u=n.a,a=Math.max(t,e,r),i=a-Math.min(t,e,r),o=i?a===t?(e-r)/i:a===e?2+(r-t)/i:4+(t-e)/i:0;return{h:60*(o<0?o+6:o),s:a?i/a*100:0,v:a/255*100,a:u}},k=function(n){var t=n.h,e=n.s,r=n.v,u=n.a;t=t/360*6,e/=100,r/=100;var a=Math.floor(t),i=r*(1-e),o=r*(1-(t-a)*e),l=r*(1-(1-t+a)*e),p=a%6;return{r:255*[r,o,i,i,l,r][p],g:255*[l,r,r,o,i,i][p],b:255*[i,i,l,r,r,o][p],a:u}},N=function(n){return{h:w(n.h),s:d(n.s,0,100),l:d(n.l,0,100),a:d(n.a)}},x=function(n){return{h:s(n.h),s:s(n.s),l:s(n.l),a:s(n.a,3)}},I=function(n){return k((e=(t=n).s,{h:t.h,s:(e*=((r=t.l)<50?r:100-r)/100)>0?2*e/(r+e)*100:0,v:r+e,a:t.a}));var t,e,r},b=function(n){return{h:(t=S(n)).h,s:(u=(200-(e=t.s))*(r=t.v)/100)>0&&u<200?e*r/100/(u<=100?u:200-u)*100:0,l:u/2,a:t.a};var t,e,r,u},D=/^hsla?\(\s*([+-]?\d*\.?\d+)(deg|rad|grad|turn)?\s*,\s*([+-]?\d*\.?\d+)%\s*,\s*([+-]?\d*\.?\d+)%\s*(?:,\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i,E=/^hsla?\(\s*([+-]?\d*\.?\d+)(deg|rad|grad|turn)?\s+([+-]?\d*\.?\d+)%\s+([+-]?\d*\.?\d+)%\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i,F=/^rgba?\(\s*([+-]?\d*\.?\d+)(%)?\s*,\s*([+-]?\d*\.?\d+)(%)?\s*,\s*([+-]?\d*\.?\d+)(%)?\s*(?:,\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i,L=/^rgba?\(\s*([+-]?\d*\.?\d+)(%)?\s+([+-]?\d*\.?\d+)(%)?\s+([+-]?\d*\.?\d+)(%)?\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i,H={string:[[function(n){var t=q.exec(n);return t?(n=t[1]).length<=4?{r:parseInt(n[0]+n[0],16),g:parseInt(n[1]+n[1],16),b:parseInt(n[2]+n[2],16),a:n.length===4?s(parseInt(n[3]+n[3],16)/255,2):1}:n.length===6||n.length===8?{r:parseInt(n.substr(0,2),16),g:parseInt(n.substr(2,2),16),b:parseInt(n.substr(4,2),16),a:n.length===8?s(parseInt(n.substr(6,2),16)/255,2):1}:null:null},"hex"],[function(n){var t=F.exec(n)||L.exec(n);return t?t[2]!==t[4]||t[4]!==t[6]?null:m({r:Number(t[1])/(t[2]?100/255:1),g:Number(t[3])/(t[4]?100/255:1),b:Number(t[5])/(t[6]?100/255:1),a:t[7]===void 0?1:Number(t[7])/(t[8]?100:1)}):null},"rgb"],[function(n){var t=D.exec(n)||E.exec(n);if(!t)return null;var e,r,u=N({h:(e=t[1],r=t[2],r===void 0&&(r="deg"),Number(e)*(R[r]||1)),s:Number(t[3]),l:Number(t[4]),a:t[5]===void 0?1:Number(t[5])/(t[6]?100:1)});return I(u)},"hsl"]],object:[[function(n){var t=n.r,e=n.g,r=n.b,u=n.a,a=u===void 0?1:u;return h(t)&&h(e)&&h(r)?m({r:Number(t),g:Number(e),b:Number(r),a:Number(a)}):null},"rgb"],[function(n){var t=n.h,e=n.s,r=n.l,u=n.a,a=u===void 0?1:u;if(!h(t)||!h(e)||!h(r))return null;var i=N({h:Number(t),s:Number(e),l:Number(r),a:Number(a)});return I(i)},"hsl"],[function(n){var t=n.h,e=n.s,r=n.v,u=n.a,a=u===void 0?1:u;if(!h(t)||!h(e)||!h(r))return null;var i=function(o){return{h:w(o.h),s:d(o.s,0,100),v:d(o.v,0,100),a:d(o.a)}}({h:Number(t),s:Number(e),v:Number(r),a:Number(a)});return k(i)},"hsv"]]},M=function(n,t){for(var e=0;e<t.length;e++){var r=t[e][0](n);if(r)return[r,t[e][1]]}return[null,void 0]},P=function(n){return typeof n=="string"?M(n.trim(),H.string):typeof n=="object"&&n!==null?M(n,H.object):[null,void 0]},v=function(n,t){var e=b(n);return{h:e.h,s:d(e.s+100*t,0,100),l:e.l,a:e.a}},y=function(n){return(299*n.r+587*n.g+114*n.b)/1e3/255},$=function(n,t){var e=b(n);return{h:e.h,s:e.s,l:d(e.l+100*t,0,100),a:e.a}},j=function(){function n(t){this.parsed=P(t)[0],this.rgba=this.parsed||{r:0,g:0,b:0,a:1}}return n.prototype.isValid=function(){return this.parsed!==null},n.prototype.brightness=function(){return s(y(this.rgba),2)},n.prototype.isDark=function(){return y(this.rgba)<.5},n.prototype.isLight=function(){return y(this.rgba)>=.5},n.prototype.toHex=function(){return t=c(this.rgba),e=t.r,r=t.g,u=t.b,i=(a=t.a)<1?g(s(255*a)):"","#"+g(e)+g(r)+g(u)+i;var t,e,r,u,a,i},n.prototype.toRgb=function(){return c(this.rgba)},n.prototype.toRgbString=function(){return t=c(this.rgba),e=t.r,r=t.g,u=t.b,(a=t.a)<1?"rgba("+e+", "+r+", "+u+", "+a+")":"rgb("+e+", "+r+", "+u+")";var t,e,r,u,a},n.prototype.toHsl=function(){return x(b(this.rgba))},n.prototype.toHslString=function(){return t=x(b(this.rgba)),e=t.h,r=t.s,u=t.l,(a=t.a)<1?"hsla("+e+", "+r+"%, "+u+"%, "+a+")":"hsl("+e+", "+r+"%, "+u+"%)";var t,e,r,u,a},n.prototype.toHsv=function(){return t=S(this.rgba),{h:s(t.h),s:s(t.s),v:s(t.v),a:s(t.a,3)};var t},n.prototype.invert=function(){return f({r:255-(t=this.rgba).r,g:255-t.g,b:255-t.b,a:t.a});var t},n.prototype.saturate=function(t){return t===void 0&&(t=.1),f(v(this.rgba,t))},n.prototype.desaturate=function(t){return t===void 0&&(t=.1),f(v(this.rgba,-t))},n.prototype.grayscale=function(){return f(v(this.rgba,-1))},n.prototype.lighten=function(t){return t===void 0&&(t=.1),f($(this.rgba,t))},n.prototype.darken=function(t){return t===void 0&&(t=.1),f($(this.rgba,-t))},n.prototype.rotate=function(t){return t===void 0&&(t=15),this.hue(this.hue()+t)},n.prototype.alpha=function(t){return typeof t=="number"?f({r:(e=this.rgba).r,g:e.g,b:e.b,a:t}):s(this.rgba.a,3);var e},n.prototype.hue=function(t){var e=b(this.rgba);return typeof t=="number"?f({h:t,s:e.s,l:e.l,a:e.a}):s(e.h)},n.prototype.isEqual=function(t){return this.toHex()===f(t).toHex()},n}(),f=function(n){return n instanceof j?n:new j(n)};export{f as w};