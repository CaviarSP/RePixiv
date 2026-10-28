(() => {
"use strict";

/* 先部署 Worker，再把 API_BASE 改为 Worker 的 HTTPS 地址，并关闭 DEMO_MODE。 */
const CONFIG = {
  API_BASE: "https://api.example.com",
  DEMO_MODE: true,
  TIMEOUT_MS: 30000
};
const $ = id => document.getElementById(id);
const ui = {
  status:$("status"), welcome:$("welcome"), welcomeText:$("welcomeText"), retry:$("retry"),
  gallery:$("gallery"), title:$("title"), description:$("description"), counter:$("counter"),
  stage:$("stage"), placeholder:$("placeholder"), main:$("mainImage"), loading:$("loading"),
  imageError:$("imageError"), imageName:$("imageName"), openImage:$("openImage"),
  thumbs:$("thumbs"), prev:$("prev"), next:$("next"), errorPanel:$("errorPanel"),
  errorTitle:$("errorTitle"), errorText:$("errorText"), errorRetry:$("errorRetry"), mode:$("mode")
};
const demo = {
  title:"演示图片集", description:"前端演示模式。接入 Worker 后会显示你的图片集。",
  images:[
    {id:"d1",name:"山间清晨",demoUrl:"https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=max&w=1600&q=80"},
    {id:"d2",name:"湖泊与云",demoUrl:"https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=max&w=1600&q=80"},
    {id:"d3",name:"海边日落",demoUrl:"https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=max&w=1600&q=80"},
    {id:"d4",name:"森林小径",demoUrl:"https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=max&w=1600&q=80"},
    {id:"d5",name:"群山之间",demoUrl:"https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=max&w=1600&q=80"}
  ]
};
let key=null, gallery=null, index=0, urls=new Map(), loadingIds=new Set(), touchX=null;

function status(s){ui.status.textContent=s}
function show(el){el.hidden=false} function hide(el){el.hidden=true}
function readKey(){
  const u=new URL(location.href), hash=new URLSearchParams(location.hash.slice(1));
  const k=hash.get("key") || u.searchParams.get("key");
  if(!k)return null;
  if(k.length>512 || !/^[A-Za-z0-9._~-]+$/.test(k)) throw Error("链接中的密钥格式无效，请检查链接是否完整。");
  return k;
}
function welcome(msg,retry=false){show(ui.welcome);hide(ui.gallery);hide(ui.errorPanel);ui.welcomeText.textContent=msg;ui.retry.hidden=!retry}
function fatal(msg){hide(ui.welcome);hide(ui.gallery);show(ui.errorPanel);ui.errorTitle.textContent="无法打开图片集";ui.errorText.textContent=msg;status("加载失败")}
async function request(url,opts={}){
  const c=new AbortController(), t=setTimeout(()=>c.abort(),CONFIG.TIMEOUT_MS);
  try{return await fetch(url,{...opts,signal:c.signal,cache:"no-store",redirect:"error",referrerPolicy:"no-referrer"})}
  catch(e){if(e.name==="AbortError")throw Error("请求超时，请稍后重试。");throw e}
  finally{clearTimeout(t)}
}
async function post(path,body,binary=false){
  const r=await request(CONFIG.API_BASE.replace(/\/+$/,"")+path,{
    method:"POST",headers:{"Content-Type":"application/json","Accept":binary?"application/octet-stream":"application/json"},
    credentials:"omit",body:JSON.stringify(body)
  });
  if(!r.ok){let msg="";try{const j=await r.json();msg=j.error||j.message||""}catch(_){}throw Error(msg||`服务器请求失败（HTTP ${r.status}）。`)}
  return binary?r.arrayBuffer():r.json();
}
async function decrypt(buffer){
  const b=new Uint8Array(buffer);
  if(b.length<32)throw Error("加密图片数据不完整。");
  if(String.fromCharCode(...b.slice(0,4))!=="RPX1")throw Error("图片数据格式错误：预期 RPX1。");
  const iv=b.slice(4,16), ciphertext=b.slice(16);
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(key));
  const aes=await crypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["decrypt"]);
  try{return await crypto.subtle.decrypt({name:"AES-GCM",iv,tagLength:128},aes,ciphertext)}
  catch(_){throw Error("图片解密失败：密钥或服务端加密协议不匹配。")}
}
function cleanup(){for(const u of urls.values())URL.revokeObjectURL(u);urls.clear();loadingIds.clear()}
async function loadGallery(){
  cleanup();index=0;welcome("正在验证密钥并读取图片集…");status("正在加载");
  if(CONFIG.DEMO_MODE){gallery=demo;ui.mode.textContent="演示模式"}
  else{
    if(!key)throw Error("链接中没有密钥。请使用 https://view.example/#key=你的密钥");
    gallery=await post("/api/gallery",{key});
    if(!gallery||!Array.isArray(gallery.images))throw Error("后端响应格式错误：缺少 images 数组。");
    ui.mode.textContent="加密图片查看器";
  }
  if(!gallery.images.length)throw Error("这个图片集暂时没有图片。");
  render();await select(0);
}
function render(){
  hide(ui.welcome);hide(ui.errorPanel);show(ui.gallery);
  ui.title.textContent=gallery.title||"图片集";ui.description.textContent=gallery.description||"";
  ui.thumbs.replaceChildren();
  gallery.images.forEach((im,i)=>{
    const b=document.createElement("button");b.className="thumb";b.type="button";b.title=im.name||`图片 ${i+1}`;
    const img=document.createElement("img");img.alt="";img.loading=i<6?"eager":"lazy";img.hidden=true;
    const fallback=document.createElement("span");fallback.className="fallback";fallback.textContent=String(i+1);
    b.append(img,fallback);b.addEventListener("click",()=>select(i));ui.thumbs.append(b);
  });
  update();status(`${gallery.images.length} 张图片`);
  for(let i=0;i<Math.min(8,gallery.images.length);i++)if(i!==index)imageUrl(i).then(u=>setThumb(i,u)).catch(()=>{});
}
function setThumb(i,url){const b=ui.thumbs.children[i];if(!b)return;const img=b.querySelector("img");img.src=url;img.hidden=false;b.querySelector(".fallback").hidden=true}
function update(){
  ui.counter.textContent=`${index+1} / ${gallery.images.length}`;ui.imageName.textContent=gallery.images[index].name||`图片 ${index+1}`;
  ui.prev.disabled=ui.next.disabled=gallery.images.length<2;
  [...ui.thumbs.children].forEach((b,i)=>{b.classList.toggle("active",i===index);if(i===index)b.scrollIntoView({behavior:"smooth",block:"nearest",inline:"nearest"})});
}
async function imageUrl(i){
  if(urls.has(i))return urls.get(i);
  if(loadingIds.has(i)){while(loadingIds.has(i)){await new Promise(r=>setTimeout(r,80));if(urls.has(i))return urls.get(i)}if(urls.has(i))return urls.get(i);throw Error("图片加载失败。")}
  loadingIds.add(i);
  try{
    const im=gallery.images[i];let u;
    if(CONFIG.DEMO_MODE&&im.demoUrl){const r=await request(im.demoUrl);if(!r.ok)throw Error("演示图片加载失败。");u=URL.createObjectURL(await r.blob())}
    else{const buf=await post("/api/image",{key,imageId:im.id},true);const plain=await decrypt(buf);const mime=/^image\/(jpeg|png|webp|gif|avif)$/.test(im.mimeType||"")?im.mimeType:"image/jpeg";u=URL.createObjectURL(new Blob([plain],{type:mime}))}
    urls.set(i,u);return u;
  }finally{loadingIds.delete(i)}
}
async function select(i){
  if(!gallery?.images.length)return;index=(i+gallery.images.length)%gallery.images.length;update();
  hide(ui.main);hide(ui.placeholder);hide(ui.imageError);show(ui.loading);ui.loading.textContent="正在获取并解密图片…";hide(ui.openImage);
  try{
    const u=await imageUrl(index);ui.main.onload=()=>hide(ui.loading);ui.main.onerror=()=>{hide(ui.loading);show(ui.imageError);ui.imageError.textContent="图片已解密，但浏览器无法显示该格式。"};
    ui.main.src=u;ui.main.alt=gallery.images[index].name||`图片 ${index+1}`;if(ui.main.complete&&ui.main.naturalWidth)hide(ui.loading);
    ui.openImage.href=u;show(ui.openImage);setThumb(index,u);
  }catch(e){hide(ui.loading);show(ui.imageError);ui.imageError.textContent=e.message||"图片加载失败。"}
}
function move(d){if(gallery?.images.length)select(index+d)}
async function boot(){try{key=readKey();if(!CONFIG.DEMO_MODE&&!key){welcome("链接中没有找到密钥，请确认 QQ 消息中的链接完整。");status("缺少密钥");return}await loadGallery()}catch(e){fatal(e.message||"发生未知错误。")}}
ui.prev.addEventListener("click",()=>move(-1));ui.next.addEventListener("click",()=>move(1));
ui.retry.addEventListener("click",boot);ui.errorRetry.addEventListener("click",boot);
document.addEventListener("keydown",e=>{if(e.key==="ArrowLeft")move(-1);if(e.key==="ArrowRight")move(1)});
ui.stage.addEventListener("touchstart",e=>{touchX=e.changedTouches[0]?.clientX??null},{passive:true});
ui.stage.addEventListener("touchend",e=>{if(touchX===null)return;const d=e.changedTouches[0].clientX-touchX;if(Math.abs(d)>45)move(d<0?1:-1);touchX=null},{passive:true});
addEventListener("pagehide",cleanup);
if(CONFIG.DEMO_MODE){status("演示模式");welcome("演示模式已开启。接入 Worker 后关闭演示模式即可加载私有图片集。")}
boot();
})();