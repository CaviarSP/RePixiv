/*
 * RePixiv static frontend.
 * Configure API_BASE and DEMO_MODE below after deploying the Cloudflare Worker.
 *
 * GET /api/gallery/{galleryId} -> {
 *   "id":"abc123","title":"Gallery","description":"3 images",
 *   "images":[{"id":"img1","name":"1.jpg","thumbnailUrl":"/api/thumb/img1"}]
 * }
 * GET /api/image/{imageId} -> image bytes with Content-Type: image/jpeg (etc).
 * Requests use credentials: include for cookie-based sessions.
 *
 * This version expects browser-displayable image bytes. If the backend will return
 * encrypted bytes, implement the agreed decryption protocol here before production.
 */
const CONFIG = {
  API_BASE: "https://img.caviarsp.top", // e.g. "https://img-api.example.workers.dev"
  DEMO_MODE: true
};
const DEMO = {
  id:"demo", title:"演示画廊", description:"演示图片来自 Unsplash；正式模式会从 Worker 加载。",
  images:[
    {id:"d1",name:"山间湖泊",url:"https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1600&q=85",thumbnailUrl:"https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=240&q=70"},
    {id:"d2",name:"海岸与岩石",url:"https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1600&q=85",thumbnailUrl:"https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=240&q=70"},
    {id:"d3",name:"森林小路",url:"https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1600&q=85",thumbnailUrl:"https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=240&q=70"},
    {id:"d4",name:"雪山",url:"https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=85",thumbnailUrl:"https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=240&q=70"},
    {id:"d5",name:"沙漠",url:"https://images.unsplash.com/photo-1509316785289-025f5b846b35?auto=format&fit=crop&w=1600&q=85",thumbnailUrl:"https://images.unsplash.com/photo-1509316785289-025f5b846b35?auto=format&fit=crop&w=240&q=70"}
  ]
};
const $=id=>document.getElementById(id);
const S={gallery:null,index:0,token:0,objectUrl:null};
function hide(id,value=true){$(id).classList.toggle("hidden",value)}
function status(s){$("status").textContent=s||""}
function urlFor(path){return /^https?:\/\//i.test(path)?path:`${CONFIG.API_BASE}${path.startsWith("/")?"":"/"}${path}`}
function currentGallery(){return new URLSearchParams(location.search).get("gallery")||""}
function setGalleryUrl(id){const u=new URL(location.href);id?u.searchParams.set("gallery",id):u.searchParams.delete("gallery");history.replaceState({},"",u)}
async function apiJson(path){
  if(!CONFIG.API_BASE)throw Error("尚未配置 API_BASE。请先部署 Worker，再修改 app.js。");
  const r=await fetch(`${CONFIG.API_BASE}${path}`,{credentials:"include",cache:"no-store",headers:{Accept:"application/json"}});
  if(r.status===401||r.status===403)throw Error("浏览器尚未登记，或登记凭据已失效。");
  if(!r.ok)throw Error(`后端请求失败（HTTP ${r.status}）。`);
  return r.json();
}
async function getGallery(id){
  if(CONFIG.DEMO_MODE&&id.toLowerCase()==="demo")return structuredClone(DEMO);
  const raw=await apiJson(`/api/gallery/${encodeURIComponent(id)}`);
  if(!raw||!Array.isArray(raw.images))throw Error("后端返回格式错误：缺少 images 数组。");
  return {...raw,images:raw.images.map((x,i)=>({id:x.id,name:x.name||`图片 ${i+1}`,url:x.url||x.imageUrl||`/api/image/${encodeURIComponent(x.id)}`,thumbnailUrl:x.thumbnailUrl||""}))};
}
function clearObject(){if(S.objectUrl)URL.revokeObjectURL(S.objectUrl);S.objectUrl=null}
function imagePath(item){if(CONFIG.DEMO_MODE&&item.url)return item.url;return urlFor(item.url||`/api/image/${encodeURIComponent(item.id)}`)}
async function fetchImage(item,token){
  const r=await fetch(imagePath(item),{credentials:"include",cache:"no-store",headers:{Accept:"image/*,*/*;q=0.8"}});
  if(token!==S.token)return null;
  if(r.status===401||r.status===403)throw Error("授权失效或浏览器尚未登记。");
  if(!r.ok)throw Error(`图片请求失败（HTTP ${r.status}）。`);
  const blob=await r.blob();if(token!==S.token)return null;
  if(!blob.type.startsWith("image/"))throw Error("后端响应不是 image/*。请检查 Worker 的 Content-Type。");
  return URL.createObjectURL(blob);
}
function renderThumbs(){
  const root=$("thumbs");root.replaceChildren();
  S.gallery.images.forEach((item,i)=>{
    const b=document.createElement("button");b.className="thumb"+(i===S.index?" active":"");b.type="button";b.title=item.name;b.setAttribute("aria-label",`第 ${i+1} 张：${item.name}`);
    if(item.thumbnailUrl){const im=new Image();im.loading="lazy";im.alt="";im.src=urlFor(item.thumbnailUrl);im.onerror=()=>{im.remove();const p=document.createElement("span");p.className="placeholder";p.textContent=`图片 ${i+1}`;b.prepend(p)};b.append(im)}
    else{const p=document.createElement("span");p.className="placeholder";p.textContent=`图片 ${i+1}`;b.append(p)}
    const n=document.createElement("span");n.className="num";n.textContent=i+1;b.append(n);b.addEventListener("click",()=>showImage(i));root.append(b);
  });
  root.querySelector(".active")?.scrollIntoView({block:"nearest",inline:"nearest",behavior:"smooth"});
}
async function showImage(i){
  if(!S.gallery)return;
  S.index=Math.max(0,Math.min(i,S.gallery.images.length-1));const item=S.gallery.images[S.index],token=++S.token;clearObject();
  $("main").removeAttribute("src");hide("main");hide("error");hide("loading",false);$("loading").innerHTML="<i></i> 正在加载图片…";
  $("counter").textContent=`${S.index+1} / ${S.gallery.images.length}`;$("name").textContent=item.name;$("main").alt=item.name;
  $("prev").disabled=S.index===0;$("next").disabled=S.index===S.gallery.images.length-1;renderThumbs();status("");
  try{const object=await fetchImage(item,token);if(!object||token!==S.token)return;S.objectUrl=object;$("main").src=object;hide("loading");hide("main",false);$("main").onload=()=>status(`${$("main").naturalWidth} × ${$("main").naturalHeight}`)}
  catch(e){if(token!==S.token)return;hide("loading");hide("error",false);$("errorText").textContent=e.message||"未知错误";status("加载失败")}
}
async function openGallery(id){
  id=(id||"").trim();if(!id){alert("请输入画廊 ID。");return}
  $("galleryId").value=id;hide("welcome");hide("viewer",false);$("title").textContent="正在加载…";$("desc").textContent="";status("正在加载画廊…");
  try{const g=await getGallery(id);if(!g.images.length)throw Error("这个画廊还没有图片。");S.gallery=g;S.index=0;$("title").textContent=g.title||"图片画廊";$("desc").textContent=g.description||`${g.images.length} 张图片`;$("eyebrow").textContent=`GALLERY · ${g.id||id}`;setGalleryUrl(id);await showImage(0)}
  catch(e){S.gallery=null;$("title").textContent="无法打开画廊";$("desc").textContent=e.message;hide("loading");hide("main");hide("error",false);$("errorText").textContent=e.message;status("请检查配置后重试")}
}
function back(){S.token++;clearObject();S.gallery=null;hide("viewer");hide("welcome",false);setGalleryUrl("")}
$("form").addEventListener("submit",e=>{e.preventDefault();openGallery($("galleryId").value)});
$("demo").addEventListener("click",()=>openGallery("demo"));
$("prev").addEventListener("click",()=>showImage(S.index-1));$("next").addEventListener("click",()=>showImage(S.index+1));$("retry").addEventListener("click",()=>showImage(S.index));
$("back").addEventListener("click",back);$("reload").addEventListener("click",()=>S.gallery?openGallery(S.gallery.id):location.reload());
$("info").addEventListener("click",()=>{const d=$("about");if(d.showModal)d.showModal();else alert("RePixiv 静态前端")});
$("open").addEventListener("click",()=>{if(S.gallery)window.open(imagePath(S.gallery.images[S.index]),"_blank","noopener,noreferrer")});
document.addEventListener("keydown",e=>{if($("viewer").classList.contains("hidden")||$("about").open)return;if(e.key==="ArrowLeft"){e.preventDefault();showImage(S.index-1)}if(e.key==="ArrowRight"){e.preventDefault();showImage(S.index+1)}if(e.key==="Escape")back()});
let sx=0,sy=0;$("viewport").addEventListener("touchstart",e=>{if(e.touches.length===1){sx=e.touches[0].clientX;sy=e.touches[0].clientY}},{passive:true});
$("viewport").addEventListener("touchend",e=>{if(e.changedTouches.length!==1)return;const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.25)showImage(S.index+(dx<0?1:-1))},{passive:true});
window.addEventListener("beforeunload",clearObject);
const initial=currentGallery();if(initial)openGallery(initial);
