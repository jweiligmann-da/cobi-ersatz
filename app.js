let watchId=null,running=false,lastAccepted=null,totalMeters=0,startTime=null,timer=null;
let map=null,marker=null,trackLine=null,gpxLine=null,currentLatLng=null,track=[];
let route=[],routeCum=[],routeTotal=0,routeName="",followMode=true,lastNearest=0,handlebar=false;
let maxSpeed=0,lastRideEnd=null;

const $=id=>document.getElementById(id);

function updateClock(){$("clock").textContent=new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"});}
setInterval(updateClock,1000);updateClock();

function hav(a,b){const R=6371000,rad=x=>x*Math.PI/180,dLat=rad(b[0]-a[0]),dLon=rad(b[1]-a[1]);
const x=Math.sin(dLat/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(x));}
function bearing(a,b){const r=x=>x*Math.PI/180,d=x=>x*180/Math.PI,p1=r(a[0]),p2=r(b[0]),dl=r(b[1]-a[1]);
const y=Math.sin(dl)*Math.cos(p2),x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);return(d(Math.atan2(y,x))+360)%360;}
function angleDiff(a,b){return((b-a+540)%360)-180;}
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
function updateRouteGuidance(p){const n=nearestRouteIndex(p);if(n.idx<0)return;const remaining=Math.max(0,routeTotal-routeCum[n.idx]);
$("remaining").textContent=(remaining/1000).toFixed(1)+" km";$("offRoute").textContent=Math.round(n.dist)+" m";$("offRoute").className=n.dist>60?"danger":n.dist>30?"warn":"ok";
setTurn(findNextTurn(n.idx),remaining);$("routeWarning").classList.toggle("hidden",n.dist<=60);}

$("startBtn").onclick=()=>{if(!navigator.geolocation){$("message").textContent="Dieser Browser unterstützt kein GPS.";return;}
running=true;lastRideEnd=null;startTime=Date.now();lastAccepted=null;totalMeters=0;maxSpeed=0;track=[];$("saveBtn").disabled=true;
$("startBtn").disabled=true;$("stopBtn").disabled=false;$("gpsStatus").textContent="GPS wird gesucht …";
timer=setInterval(updateTimer,1000);
watchId=navigator.geolocation.watchPosition(pos=>{const c=pos.coords,acc=c.accuracy||999,kmh=(c.speed!=null&&c.speed>=0)?c.speed*3.6:0;
$("accuracy").textContent=Math.round(acc)+" m";$("position").textContent=c.latitude.toFixed(5)+", "+c.longitude.toFixed(5);$("speed").textContent=kmh.toFixed(1);
$("navSpeed").textContent=kmh.toFixed(1)+" km/h";$("gpsStatus").textContent="GPS aktiv";if(kmh>maxSpeed){maxSpeed=kmh;$("maxSpeed").textContent=maxSpeed.toFixed(1)+" km/h";}
updateMap(c.latitude,c.longitude);const p=[c.latitude,c.longitude];if(lastAccepted){const d=hav(lastAccepted,p),moving=(kmh>=1.5)||(d>=8);if(acc<=35&&d>=3&&d<=120&&moving)totalMeters+=d;}
if(acc<=35)lastAccepted=p;$("distance").textContent=(totalMeters/1000).toFixed(2)+" km";updateAvg();},err=>{$("gpsStatus").textContent="GPS-Fehler";
$("message").textContent=err.code===1?"Standortzugriff wurde nicht erlaubt.":"GPS-Position konnte nicht bestimmt werden.";},{enableHighAccuracy:true,maximumAge:500,timeout:15000});};

$("stopBtn").onclick=()=>{running=false;lastRideEnd=Date.now();clearInterval(timer);if(watchId!==null)navigator.geolocation.clearWatch(watchId);watchId=null;
$("speed").textContent="0.0";$("navSpeed").textContent="0.0 km/h";$("gpsStatus").textContent="Fahrt gestoppt";$("startBtn").disabled=false;$("stopBtn").disabled=true;
$("saveBtn").disabled=!(track.length>1||totalMeters>0);updateTimer();};

$("resetBtn").onclick=()=>{if(running)$("stopBtn").click();totalMeters=0;startTime=null;lastRideEnd=null;lastAccepted=null;track=[];maxSpeed=0;
$("distance").textContent="0.00 km";$("rideTime").textContent="00:00:00";$("accuracy").textContent="-- m";$("position").textContent="--";$("avgSpeed").textContent="0.0 km/h";
$("maxSpeed").textContent="0.0 km/h";$("gpsStatus").textContent="GPS noch nicht gestartet";$("saveBtn").disabled=true;if(trackLine)trackLine.setLatLngs([]);};

function page(which){["ridePage","navPage","historyPage"].forEach(id=>$(id).classList.add("hidden"));
["rideBtn","navBtn","historyBtn"].forEach(id=>$(id).classList.remove("active"));
if(which==="ride"){$("ridePage").classList.remove("hidden");$("rideBtn").classList.add("active");}
if(which==="nav"){$("navPage").classList.remove("hidden");$("navBtn").classList.add("active");initMap();setTimeout(()=>map.invalidateSize(),120);if(currentLatLng)map.setView(currentLatLng,17);else if(route.length)map.fitBounds(gpxLine.getBounds(),{padding:[20,20]});}
if(which==="history"){$("historyPage").classList.remove("hidden");$("historyBtn").classList.add("active");renderHistory();}}
$("rideBtn").onclick=()=>page("ride");$("navBtn").onclick=()=>page("nav");$("historyBtn").onclick=()=>page("history");

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
    $("message").textContent="GPX geladen: "+file.name+" · "+route.length+" Punkte";
    $("routeWarning").classList.add("hidden");

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

function loadHistory(){try{return JSON.parse(localStorage.getItem("cobi_v6_rides")||"[]");}catch{return[];}}
function saveHistory(arr){localStorage.setItem("cobi_v6_rides",JSON.stringify(arr));}
function rideSummary(){const ms=elapsedMs(),hours=ms/3600000,km=totalMeters/1000,avg=hours>0?km/hours:0;
return{id:Date.now(),date:new Date().toISOString(),distanceKm:km,durationMs:ms,avgKmh:avg,maxKmh:maxSpeed,routeName:routeName||"",track:track.slice(0,3000)};}
$("saveBtn").onclick=()=>{const rides=loadHistory();rides.unshift(rideSummary());saveHistory(rides.slice(0,100));$("message").textContent="Fahrt gespeichert."; $("saveBtn").disabled=true;renderHistory();};
$("clearHistoryBtn").onclick=()=>{if(confirm("Alle gespeicherten Fahrten löschen?")){saveHistory([]);renderHistory();}};
function renderHistory(){const rides=loadHistory();$("historyCount").textContent=rides.length;const box=$("historyList");box.innerHTML="";
if(!rides.length){box.innerHTML='<div class="empty">Noch keine Fahrten gespeichert.</div>';return;}
rides.forEach(r=>{const d=new Date(r.date);const item=document.createElement("div");item.className="historyItem";
item.innerHTML=`<h3>${d.toLocaleDateString("de-DE")} · ${d.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})}</h3>
<div class="historyStats"><div><span>Distanz</span><strong>${r.distanceKm.toFixed(2)} km</strong></div><div><span>Fahrzeit</span><strong>${timeText(r.durationMs)}</strong></div><div><span>Ø</span><strong>${r.avgKmh.toFixed(1)} km/h</strong></div><div><span>Max</span><strong>${r.maxKmh.toFixed(1)} km/h</strong></div></div>
${r.routeName?`<small>Route: ${r.routeName}</small>`:""}
<div class="historyActions"><button data-del="${r.id}">Löschen</button></div>`;
box.appendChild(item);});
box.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{const id=+b.dataset.del;saveHistory(loadHistory().filter(r=>r.id!==id));renderHistory();});}
renderHistory();
