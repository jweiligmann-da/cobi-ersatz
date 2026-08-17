let watchId=null,running=false,lastAccepted=null,totalMeters=0,startTime=null,timer=null;
let map=null,marker=null,trackLine=null,gpxLine=null,currentLatLng=null,track=[];
let route=[],routeCum=[],routeTotal=0,routeName="",followMode=true,lastNearest=0,handlebar=false;
let maxSpeed=0,lastRideEnd=null;
let rideDetailMap=null,rideDetailLine=null,currentDetailRide=null;
let bikeDemoTimer=null,bikeDemoMode="OFF";

const $=id=>document.getElementById(id);

function updateClock(){$("clock").textContent=new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"});}
setInterval(updateClock,1000);updateClock();

function hav(a,b){const R=6371000,rad=x=>x*Math.PI/180,dLat=rad(b[0]-a[0]),dLon=rad(b[1]-a[1]);
const x=Math.sin(dLat/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(x));}
function bearing(a,b){const r=x=>x*Math.PI/180,d=x=>x*180/Math.PI,p1=r(a[0]),p2=r(b[0]),dl=r(b[1]-a[1]);
const y=Math.sin(dl)*Math.cos(p2),x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);return(d(Math.atan2(y,x))+360)%360;}
function angleDiff(a,b){return((b-a+540)%360)-180;}
function compass(deg){
  if(!Number.isFinite(deg))return "--";
  const dirs=["N","NO","O","SO","S","SW","W","NW"];
  return dirs[Math.round(((deg%360)+360)%360/45)%8];
}
function formatEta(minutes){
  if(!Number.isFinite(minutes)||minutes<0)return "--:--";
  const d=new Date(Date.now()+minutes*60000);
  return d.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"});
}
function timeText(ms){const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;
return[h,m,sec].map(v=>String(v).padStart(2,"0")).join(":");}
function elapsedMs(){return startTime?((running?Date.now():lastRideEnd||Date.now())-startTime):0;}
function updateTimer(){if(startTime){$("rideTime").textContent=timeText(elapsedMs());updateAvg();}}
function updateAvg(){const h=elapsedMs()/3600000;const avg=h>0?(totalMeters/1000)/h:0;$("avgSpeed").textContent=avg.toFixed(1)+" km/h";}

function initMap(){if(map)return;map=L.map("map").setView([51.16,10.45],6);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap"}).addTo(map);
trackLine=L.polyline([],{weight:5}).addTo(map);}
function updateMap(lat,lon){initMap();currentLatLng=[lat,lon];if(!marker)marker=L.circleMarker(currentLatLng,{radius:9,weight:3,fillOpacity:.85}).addTo(map);
else marker.setLatLng(currentLatLng);track.push(currentLatLng);trackLine.setLatLngs(track);if(followMode)map.setView(currentLatLng,17,{animate:false});if(route.length)updateRouteGuidance(currentLatLng);}
function buildRouteCum(){routeCum=[0];routeTotal=0;for(let i=1;i<route.length;i++){routeTotal+=hav(route[i-1],route[i]);routeCum.push(routeTotal);}}
function nearestRouteIndex(p){if(!route.length)return{idx:-1,dist:Infinity};let start=Math.max(0,lastNearest-100),end=Math.min(route.length-1,lastNearest+320);
if(lastNearest===0){start=0;end=route.length-1;}let best=-1,bd=Infinity;for(let i=start;i<=end;i++){const d=hav(p,route[i]);if(d<bd){bd=d;best=i;}}lastNearest=best;return{idx:best,dist:bd};}
function findNextTurn(idx){if(route.length<5)return null;for(let i=Math.max(idx+3,3);i<route.length-3;i++){const travelled=routeCum[i]-routeCum[idx];if(travelled<30)continue;
const b1=bearing(route[i-3],route[i]),b2=bearing(route[i],route[i+3]),diff=angleDiff(b1,b2);if(Math.abs(diff)>=28)return{idx:i,distance:routeCum[i]-routeCum[idx],diff};if(travelled>1500)break;}return null;}
function setTurn(turn,remaining){if(turn){const m=Math.max(0,Math.round(turn.distance));$("turnDistance").textContent=m<1000?m+" m":(m/1000).toFixed(1)+" km";
if(turn.diff>0){$("turnIcon").textContent=turn.diff>115?"↶":"↰";$("turnText").textContent=turn.diff>115?"Scharf links":"Links abbiegen";}
else{$("turnIcon").textContent=turn.diff<-115?"↷":"↱";$("turnText").textContent=turn.diff<-115?"Scharf rechts":"Rechts abbiegen";}}
else{$("turnIcon").textContent="↑";$("turnText").textContent=remaining<80?"Ziel erreicht":"Route weiter folgen";$("turnDistance").textContent=remaining<80?"":Math.round(Math.min(remaining,999))+" m";}}
function updateRouteGuidance(p){
  const n=nearestRouteIndex(p);
  if(n.idx<0)return;
  const remaining=Math.max(0,routeTotal-routeCum[n.idx]);
  const done=Math.max(0,routeCum[n.idx]);
  const pct=routeTotal>0?Math.min(100,(done/routeTotal)*100):0;

  $("remaining").textContent=(remaining/1000).toFixed(1)+" km";
  $("progress").textContent=pct.toFixed(0)+" %";
  $("offRoute").textContent=Math.round(n.dist)+" m";
  $("offRoute").className=n.dist>60?"danger":n.dist>30?"warn":"ok";

  // ETA: bevorzugt Fahrtdurchschnitt, sonst 18 km/h als vorsichtiger Startwert
  const ms=elapsedMs();
  const hours=ms/3600000;
  const avg=(hours>0 && totalMeters>100)?(totalMeters/1000)/hours:18;
  $("eta").textContent=formatEta((remaining/1000)/Math.max(avg,5)*60);

  setTurn(findNextTurn(n.idx),remaining);
  $("routeWarning").classList.toggle("hidden",n.dist<=60);
  if(n.dist>60)$("mapInfo").textContent="Achtung: Route verlassen";
}$("startBtn").onclick=()=>{if(!navigator.geolocation){$("message").textContent="Dieser Browser unterstützt kein GPS.";return;}
running=true;lastRideEnd=null;startTime=Date.now();lastAccepted=null;totalMeters=0;maxSpeed=0;track=[];$("saveBtn").disabled=true;
$("startBtn").disabled=true;$("stopBtn").disabled=false;$("gpsStatus").textContent="GPS wird gesucht …";
timer=setInterval(updateTimer,1000);
watchId=navigator.geolocation.watchPosition(pos=>{const c=pos.coords,acc=c.accuracy||999,kmh=(c.speed!=null&&c.speed>=0)?c.speed*3.6:0;
$("accuracy").textContent=Math.round(acc)+" m";$("position").textContent=c.latitude.toFixed(5)+", "+c.longitude.toFixed(5);$("speed").textContent=kmh.toFixed(1);$("bikeSpeed").textContent=kmh.toFixed(1)+" km/h";
$("navSpeed").textContent=kmh.toFixed(1)+" km/h";$("heading").textContent=compass(Number.isFinite(c.heading)?c.heading:NaN);$("gpsStatus").textContent="GPS aktiv";if(kmh>maxSpeed){maxSpeed=kmh;$("maxSpeed").textContent=maxSpeed.toFixed(1)+" km/h";}
updateMap(c.latitude,c.longitude);const p=[c.latitude,c.longitude];if(lastAccepted){const d=hav(lastAccepted,p),moving=(kmh>=1.5)||(d>=8);if(acc<=35&&d>=3&&d<=120&&moving)totalMeters+=d;}
if(acc<=35)lastAccepted=p;$("distance").textContent=(totalMeters/1000).toFixed(2)+" km";updateAvg();},err=>{$("gpsStatus").textContent="GPS-Fehler";
$("message").textContent=err.code===1?"Standortzugriff wurde nicht erlaubt.":"GPS-Position konnte nicht bestimmt werden.";},{enableHighAccuracy:true,maximumAge:500,timeout:15000});};

$("stopBtn").onclick=()=>{running=false;lastRideEnd=Date.now();clearInterval(timer);if(watchId!==null)navigator.geolocation.clearWatch(watchId);watchId=null;
$("speed").textContent="0.0";$("navSpeed").textContent="0.0 km/h";$("gpsStatus").textContent="Fahrt gestoppt";$("startBtn").disabled=false;$("stopBtn").disabled=true;
$("saveBtn").disabled=!(track.length>1||totalMeters>0);updateTimer();};

$("resetBtn").onclick=()=>{if(running)$("stopBtn").click();totalMeters=0;startTime=null;lastRideEnd=null;lastAccepted=null;track=[];maxSpeed=0;
$("distance").textContent="0.00 km";$("rideTime").textContent="00:00:00";$("accuracy").textContent="-- m";$("position").textContent="--";$("avgSpeed").textContent="0.0 km/h";
$("maxSpeed").textContent="0.0 km/h";$("gpsStatus").textContent="GPS noch nicht gestartet";$("saveBtn").disabled=true;if(trackLine)trackLine.setLatLngs([]);};

function page(which){
  ["ridePage","navPage","bikePage","routesPage","historyPage"].forEach(id=>$(id).classList.add("hidden"));
  ["rideBtn","navBtn","bikeBtn","routesBtn","historyBtn"].forEach(id=>$(id).classList.remove("active"));

  if(which==="ride"){
    $("ridePage").classList.remove("hidden");$("rideBtn").classList.add("active");
  }
  if(which==="nav"){
    $("navPage").classList.remove("hidden");$("navBtn").classList.add("active");
    initMap();setTimeout(()=>map.invalidateSize(),120);
    if(currentLatLng)map.setView(currentLatLng,17);
    else if(route.length&&gpxLine)map.fitBounds(gpxLine.getBounds(),{padding:[20,20]});
  }
  if(which==="bike"){
    $("bikePage").classList.remove("hidden");$("bikeBtn").classList.add("active");
  }
  if(which==="routes"){
    $("routesPage").classList.remove("hidden");$("routesBtn").classList.add("active");renderRoutes();
  }
  if(which==="history"){
    $("historyPage").classList.remove("hidden");$("historyBtn").classList.add("active");renderHistory();
  }
}
$("rideBtn").onclick=()=>page("ride");
$("navBtn").onclick=()=>page("nav");
$("bikeBtn").onclick=()=>page("bike");
$("routesBtn").onclick=()=>page("routes");
$("historyBtn").onclick=()=>page("history");

$("centerBtn").onclick=()=>{initMap();if(currentLatLng)map.setView(currentLatLng,17);else if(route.length)map.fitBounds(gpxLine.getBounds(),{padding:[20,20]});};
$("followBtn").onclick=()=>{followMode=!followMode;$("followBtn").textContent="Auto-Folgen: "+(followMode?"AN":"AUS");$("followBtn").classList.toggle("activeTool",followMode);};
$("fullscreenBtn").onclick=()=>{handlebar=!handlebar;document.body.classList.toggle("handlebar",handlebar);$("fullscreenBtn").textContent=handlebar?"Normalansicht":"Lenkeransicht";setTimeout(()=>{if(map)map.invalidateSize();},150);};
$("setupBtn").onclick=()=>alert("Setup wird später erweitert.");

$("gpxBtn").onclick=()=>{
  const input=$("gpxInput");
  input.value="";
  input.click();
};

function readFileText(file){
  return new Promise((resolve,reject)=>{
    try{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result||""));
      reader.onerror=()=>reject(reader.error||new Error("Datei konnte nicht gelesen werden"));
      reader.readAsText(file);
    }catch(err){reject(err);}
  });
}

function findGpxPoints(xml){
  const all=[];
  const trk=[...xml.getElementsByTagNameNS("*","trkpt")];
  const rte=[...xml.getElementsByTagNameNS("*","rtept")];
  const nodes=trk.length?trk:rte;
  for(const n of nodes){
    const lat=parseFloat(n.getAttribute("lat"));
    const lon=parseFloat(n.getAttribute("lon"));
    if(Number.isFinite(lat)&&Number.isFinite(lon))all.push([lat,lon]);
  }
  return all;
}

$("gpxInput").addEventListener("change",async e=>{
  const file=e.target.files&&e.target.files[0];
  if(!file){
    $("message").textContent="Keine Datei ausgewählt.";
    return;
  }

  $("message").textContent="GPX wird geladen: "+file.name;

  try{
    const txt=await readFileText(file);
    if(!txt || txt.length<20) throw new Error("Leere Datei");

    const xml=new DOMParser().parseFromString(txt,"application/xml");
    if(xml.getElementsByTagName("parsererror").length) throw new Error("Ungültiges XML");

    const parse=findGpxPoints(xml);
    if(parse.length<2) throw new Error("Keine GPX-Streckenpunkte gefunden");

    route=parse;
    lastNearest=0;

    const names=[
      ...xml.getElementsByTagNameNS("*","name")
    ];
    routeName=(names[0]&&names[0].textContent?names[0].textContent.trim():"") ||
              file.name.replace(/\.[^.]+$/,"");

    buildRouteCum();
    initMap();

    if(gpxLine)map.removeLayer(gpxLine);
    gpxLine=L.polyline(route,{weight:6,dashArray:"10 7"}).addTo(map);
    map.fitBounds(gpxLine.getBounds(),{padding:[20,20]});

    $("remaining").textContent=(routeTotal/1000).toFixed(1)+" km";
    $("offRoute").textContent="-- m";
    $("turnIcon").textContent="↑";
    $("turnText").textContent="Route geladen";
    $("turnDistance").textContent=(routeTotal/1000).toFixed(1)+" km gesamt";
    $("routeTitle").textContent=routeName;$("progress").textContent="0 %";$("eta").textContent="--:--";$("message").textContent="GPX geladen: "+file.name+" · "+route.length+" Punkte";
    $("routeWarning").classList.add("hidden");saveCurrentRoute();renderRoutes();

    // Direkt zur Navigation wechseln und Karte sauber neu zeichnen
    page("nav");
    setTimeout(()=>{
      if(map){
        map.invalidateSize();
        map.fitBounds(gpxLine.getBounds(),{padding:[20,20]});
      }
    },250);

  }catch(err){
    console.error(err);
    $("message").textContent="GPX konnte nicht geladen werden: "+(err.message||"unbekannter Fehler");
  }
});



/* V10 Bike-Demo / Datenoberfläche */
function setBikeMode(mode){
  bikeDemoMode=mode;
  $("bikeModeBadge").textContent=mode;
  $("bikeAssist").textContent=mode;
  document.querySelectorAll("[data-mode]").forEach(b=>b.classList.toggle("activeMode",b.dataset.mode===mode));
}
document.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>setBikeMode(b.dataset.mode));

function updateBikeDemo(){
  const modes={
    "ECO":{power:[70,180],cad:[55,75],range:[70,110]},
    "TOUR":{power:[110,260],cad:[60,80],range:[50,85]},
    "SPORT":{power:[180,420],cad:[65,90],range:[35,65]},
    "TURBO":{power:[260,650],cad:[70,100],range:[25,50]},
    "OFF":{power:[0,0],cad:[0,0],range:[0,0]}
  };
  const m=modes[bikeDemoMode]||modes.OFF;
  const rnd=(a,b)=>Math.round(a+Math.random()*(b-a));
  const battery=Math.max(5,Math.round(Number(($("bikeBattery").textContent||"80").replace(/[^\d]/g,""))||80));
  $("bikePower").textContent=rnd(m.power[0],m.power[1])+" W";
  $("bikeCadence").textContent=rnd(m.cad[0],m.cad[1])+" rpm";
  $("bikeRange").textContent=(bikeDemoMode==="OFF"?"--":rnd(m.range[0],m.range[1]))+(bikeDemoMode==="OFF"?" km":" km");
  $("bikeBattery").textContent=battery+" %";
}

$("bikeDemoOn").onclick=()=>{
  if(bikeDemoTimer)clearInterval(bikeDemoTimer);
  if(bikeDemoMode==="OFF")setBikeMode("TOUR");
  $("bikeStatus").textContent="Demo aktiv";
  $("bikeBattery").textContent="82 %";
  updateBikeDemo();
  bikeDemoTimer=setInterval(updateBikeDemo,1500);
};

$("bikeDemoOff").onclick=()=>{
  if(bikeDemoTimer)clearInterval(bikeDemoTimer);
  bikeDemoTimer=null;
  $("bikeStatus").textContent="Noch nicht verbunden";
  setBikeMode("OFF");
  $("bikeBattery").textContent="-- %";
  $("bikeRange").textContent="-- km";
  $("bikeCadence").textContent="-- rpm";
  $("bikePower").textContent="-- W";
};

/* V8: gespeicherte GPX-Routen */
function loadRoutes(){
  try{return JSON.parse(localStorage.getItem("cobi_v8_routes")||"[]");}
  catch{return[];}
}
function saveRoutes(arr){
  localStorage.setItem("cobi_v8_routes",JSON.stringify(arr));
}
function saveCurrentRoute(){
  if(route.length<2)return;
  let routes=loadRoutes();
  const item={
    id:Date.now(),
    name:routeName||"GPX Route",
    points:route,
    distance:routeTotal,
    saved:new Date().toISOString()
  };
  // Gleichnamige Route ersetzen statt doppelt speichern
  routes=routes.filter(r=>r.name!==item.name);
  routes.unshift(item);
  saveRoutes(routes.slice(0,20));
}
function activateStoredRoute(r){
  if(!r||!Array.isArray(r.points)||r.points.length<2)return;
  route=r.points;routeName=r.name||"Gespeicherte Route";lastNearest=0;
  buildRouteCum();initMap();
  if(gpxLine)map.removeLayer(gpxLine);
  gpxLine=L.polyline(route,{weight:6,dashArray:"10 7"}).addTo(map);
  $("remaining").textContent=(routeTotal/1000).toFixed(1)+" km";
  $("offRoute").textContent="-- m";
  $("turnIcon").textContent="↑";
  $("turnText").textContent="Route geladen";
  $("turnDistance").textContent=(routeTotal/1000).toFixed(1)+" km gesamt";
  $("routeTitle").textContent=routeName;
  $("progress").textContent="0 %";$("eta").textContent="--:--";
  localStorage.setItem("cobi_v8_last_route",String(r.id));
  page("nav");
  setTimeout(()=>{map.invalidateSize();map.fitBounds(gpxLine.getBounds(),{padding:[20,20]});},200);
}
function renderRoutes(){
  const routes=loadRoutes(),box=$("routesList");
  $("routeCount").textContent=routes.length;box.innerHTML="";
  if(!routes.length){
    box.innerHTML='<div class="empty">Noch keine Routen gespeichert.<br>Oben eine Komoot-GPX-Datei importieren.</div>';
    return;
  }
  routes.forEach(r=>{
    const item=document.createElement("div");item.className="routeItem";
    const date=r.saved?new Date(r.saved).toLocaleDateString("de-DE"):"";
    item.innerHTML=`<h3>${escapeHtml(r.name||"Route")}</h3>
      <small>Gespeichert ${date}</small>
      <div class="routeItemStats">
        <div><span>Distanz</span><strong>${((r.distance||0)/1000).toFixed(1)} km</strong></div>
        <div><span>GPX-Punkte</span><strong>${r.points?r.points.length:0}</strong></div>
      </div>
      <div class="routeActions">
        <button class="loadRoute" data-load="${r.id}">Route starten</button>
        <button data-rdel="${r.id}">Löschen</button>
      </div>`;
    box.appendChild(item);
  });
  box.querySelectorAll("[data-load]").forEach(b=>b.onclick=()=>{
    const r=loadRoutes().find(x=>x.id===+b.dataset.load);activateStoredRoute(r);
  });
  box.querySelectorAll("[data-rdel]").forEach(b=>b.onclick=()=>{
    saveRoutes(loadRoutes().filter(x=>x.id!==+b.dataset.rdel));renderRoutes();
  });
}
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
$("clearRoutesBtn").onclick=()=>{
  if(confirm("Alle gespeicherten Routen löschen?")){
    saveRoutes([]);localStorage.removeItem("cobi_v8_last_route");renderRoutes();
  }
};
$("routeImportBtn").onclick=()=>{
  $("routeImportInput").value="";
  $("routeImportInput").click();
};

async function importRouteFile(file,autoSave=true){
  if(!file)throw new Error("Keine Datei ausgewählt");
  const txt=await readFileText(file);
  if(!txt||txt.length<20)throw new Error("Leere Datei");
  const xml=new DOMParser().parseFromString(txt,"application/xml");
  if(xml.getElementsByTagName("parsererror").length)throw new Error("Ungültiges XML");
  const parse=findGpxPoints(xml);
  if(parse.length<2)throw new Error("Keine GPX-Streckenpunkte gefunden");

  route=parse;lastNearest=0;
  const names=[...xml.getElementsByTagNameNS("*","name")];
  routeName=(names[0]&&names[0].textContent?names[0].textContent.trim():"")||file.name.replace(/\.[^.]+$/,"");
  buildRouteCum();initMap();
  if(gpxLine)map.removeLayer(gpxLine);
  gpxLine=L.polyline(route,{weight:6,dashArray:"10 7"}).addTo(map);

  $("remaining").textContent=(routeTotal/1000).toFixed(1)+" km";
  $("offRoute").textContent="-- m";$("turnIcon").textContent="↑";
  $("turnText").textContent="Route geladen";
  $("turnDistance").textContent=(routeTotal/1000).toFixed(1)+" km gesamt";
  $("routeTitle").textContent=routeName;$("progress").textContent="0 %";$("eta").textContent="--:--";
  if(autoSave)saveCurrentRoute();
  $("message").textContent="GPX gespeichert: "+file.name+" · "+route.length+" Punkte";
  renderRoutes();
  page("nav");
  setTimeout(()=>{map.invalidateSize();map.fitBounds(gpxLine.getBounds(),{padding:[20,20]});},250);
}
$("routeImportInput").addEventListener("change",async e=>{
  try{await importRouteFile(e.target.files&&e.target.files[0],true);}
  catch(err){$("message").textContent="GPX konnte nicht geladen werden: "+(err.message||"unbekannter Fehler");}
});

function loadHistory(){try{return JSON.parse(localStorage.getItem("cobi_v6_rides")||"[]");}catch{return[];}}
function saveHistory(arr){localStorage.setItem("cobi_v6_rides",JSON.stringify(arr));}
function rideSummary(){const ms=elapsedMs(),hours=ms/3600000,km=totalMeters/1000,avg=hours>0?km/hours:0;
return{id:Date.now(),date:new Date().toISOString(),distanceKm:km,durationMs:ms,avgKmh:avg,maxKmh:maxSpeed,routeName:routeName||"",track:track.slice(0,10000)};}
$("saveBtn").onclick=()=>{const rides=loadHistory();rides.unshift(rideSummary());saveHistory(rides.slice(0,100));$("message").textContent="Fahrt gespeichert."; $("saveBtn").disabled=true;renderHistory();};
$("clearHistoryBtn").onclick=()=>{if(confirm("Alle gespeicherten Fahrten löschen?")){saveHistory([]);renderHistory();}};
function renderHistory(){
  const rides=loadHistory();
  $("historyCount").textContent=rides.length;
  const box=$("historyList");
  box.innerHTML="";

  if(!rides.length){
    box.innerHTML='<div class="empty">Noch keine Fahrten gespeichert.</div>';
    return;
  }

  rides.forEach(r=>{
    const d=new Date(r.date);
    const item=document.createElement("div");
    item.className="historyItem";
    item.innerHTML=`<h3>${d.toLocaleDateString("de-DE")} · ${d.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})}</h3>
      <div class="historyStats">
        <div><span>Distanz</span><strong>${r.distanceKm.toFixed(2)} km</strong></div>
        <div><span>Fahrzeit</span><strong>${timeText(r.durationMs)}</strong></div>
        <div><span>Ø</span><strong>${r.avgKmh.toFixed(1)} km/h</strong></div>
        <div><span>Max</span><strong>${r.maxKmh.toFixed(1)} km/h</strong></div>
      </div>
      ${r.routeName?`<small>Route: ${escapeHtml(r.routeName)}</small>`:""}
      <div class="historyActions">
        <button class="showRide" data-show="${r.id}">Auf Karte anzeigen</button>
        <button data-del="${r.id}">Löschen</button>
      </div>`;
    box.appendChild(item);
  });

  box.querySelectorAll("[data-show]").forEach(b=>b.onclick=()=>{
    const r=loadHistory().find(x=>x.id===+b.dataset.show);
    showRideDetail(r);
  });

  box.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{
    const id=+b.dataset.del;
    saveHistory(loadHistory().filter(r=>r.id!==id));
    renderHistory();
  });
}

function showRideDetail(r){
  if(!r)return;
  currentDetailRide=r;
  $("rideDetail").classList.remove("hidden");

  $("rideDetailStats").innerHTML=`
    <div><span>Distanz</span><strong>${Number(r.distanceKm||0).toFixed(2)} km</strong></div>
    <div><span>Fahrzeit</span><strong>${timeText(r.durationMs||0)}</strong></div>
    <div><span>Ø</span><strong>${Number(r.avgKmh||0).toFixed(1)} km/h</strong></div>
    <div><span>Max</span><strong>${Number(r.maxKmh||0).toFixed(1)} km/h</strong></div>`;

  setTimeout(()=>{
    if(!rideDetailMap){
      rideDetailMap=L.map("rideMap").setView([51.16,10.45],6);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
        maxZoom:19,attribution:"&copy; OpenStreetMap"
      }).addTo(rideDetailMap);
    }
    if(rideDetailLine){
      rideDetailMap.removeLayer(rideDetailLine);
      rideDetailLine=null;
    }

    const pts=Array.isArray(r.track)?r.track.filter(p=>Array.isArray(p)&&p.length>=2):[];
    if(pts.length>1){
      rideDetailLine=L.polyline(pts,{weight:5}).addTo(rideDetailMap);
      rideDetailMap.fitBounds(rideDetailLine.getBounds(),{padding:[20,20]});
    }else{
      rideDetailMap.setView([51.16,10.45],6);
    }
    rideDetailMap.invalidateSize();
  },150);
}

$("closeRideDetail").onclick=()=>{
  $("rideDetail").classList.add("hidden");
  currentDetailRide=null;
};

function xmlEscape(s){
  return String(s||"").replace(/[<>&'"]/g,c=>({
    "<":"&lt;",">":"&gt;","&":"&amp;","'":"&apos;",'"':"&quot;"
  }[c]));
}

function rideToGpx(r){
  const pts=Array.isArray(r.track)?r.track:[];
  const name=r.routeName||("COBI Fahrt "+new Date(r.date||Date.now()).toLocaleDateString("de-DE"));
  const trk=pts.map(p=>`<trkpt lat="${Number(p[0]).toFixed(7)}" lon="${Number(p[1]).toFixed(7)}"></trkpt>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="COBI Ersatz V9" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${xmlEscape(name)}</name></metadata>
  <trk><name>${xmlEscape(name)}</name><trkseg>
${trk}
  </trkseg></trk>
</gpx>`;
}

function safeFileName(s){
  return String(s||"cobi-fahrt").replace(/[\\/:*?"<>|]+/g,"-").replace(/\s+/g,"-").slice(0,80);
}

$("exportRideGpx").onclick=()=>{
  if(!currentDetailRide)return;
  const pts=Array.isArray(currentDetailRide.track)?currentDetailRide.track:[];
  if(pts.length<2){
    $("message").textContent="Diese Fahrt enthält noch keine ausreichenden GPS-Punkte für einen GPX-Export.";
    return;
  }

  const gpx=rideToGpx(currentDetailRide);
  const blob=new Blob([gpx],{type:"application/gpx+xml"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  const date=new Date(currentDetailRide.date||Date.now()).toISOString().slice(0,10);
  a.download=safeFileName(`COBI-Fahrt-${date}`)+".gpx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
};

renderHistory();});}
renderHistory();


/* Zuletzt verwendete Route beim nächsten Start wieder bereitstellen */
(function restoreLastRoute(){
  const id=+localStorage.getItem("cobi_v8_last_route");
  if(!id)return;
  const r=loadRoutes().find(x=>x.id===id);
  if(r&&Array.isArray(r.points)&&r.points.length>1){
    route=r.points;routeName=r.name||"Gespeicherte Route";lastNearest=0;buildRouteCum();
    $("remaining").textContent=(routeTotal/1000).toFixed(1)+" km";
    $("routeTitle").textContent=routeName;
    $("turnText").textContent="Letzte Route bereit";
    $("turnDistance").textContent=(routeTotal/1000).toFixed(1)+" km";
  }
})();
renderRoutes();
