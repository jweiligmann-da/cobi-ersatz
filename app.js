let watchId=null,running=false,lastAccepted=null,totalMeters=0,startTime=null,timer=null;
let map=null,marker=null,trackLine=null,gpxLine=null,currentLatLng=null,track=[];
let route=[],routeCum=[],routeTotal=0,routeName="",followMode=true,lastNearest=0;
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
function updateTimer(){if(running&&startTime)$("rideTime").textContent=timeText(Date.now()-startTime);}

function initMap(){if(map)return;map=L.map("map").setView([51.16,10.45],6);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap"}).addTo(map);
trackLine=L.polyline([],{weight:5}).addTo(map);}
function updateMap(lat,lon){initMap();currentLatLng=[lat,lon];if(!marker)marker=L.circleMarker(currentLatLng,{radius:9,weight:3,fillOpacity:.85}).addTo(map);
else marker.setLatLng(currentLatLng);track.push(currentLatLng);trackLine.setLatLngs(track);if(followMode)map.setView(currentLatLng,17,{animate:false});
$("mapInfo").textContent=(route.length?routeName+" • ":"")+"GPS aktiv";if(route.length)updateRouteGuidance(currentLatLng);}

function buildRouteCum(){routeCum=[0];routeTotal=0;for(let i=1;i<route.length;i++){routeTotal+=hav(route[i-1],route[i]);routeCum.push(routeTotal);}}
function nearestRouteIndex(p){if(!route.length)return{idx:-1,dist:Infinity};let start=Math.max(0,lastNearest-80),end=Math.min(route.length-1,lastNearest+250);
if(lastNearest===0){start=0;end=route.length-1;}let best=-1,bd=Infinity;for(let i=start;i<=end;i++){const d=hav(p,route[i]);if(d<bd){bd=d;best=i;}}
lastNearest=best;return{idx:best,dist:bd};}
function findNextTurn(idx){if(route.length<3)return null;for(let i=Math.max(idx+2,2);i<route.length-2;i++){const travelled=routeCum[i]-routeCum[idx];
if(travelled<25)continue;const b1=bearing(route[i-2],route[i]),b2=bearing(route[i],route[i+2]),diff=angleDiff(b1,b2);
if(Math.abs(diff)>=30)return{idx:i,distance:routeCum[i]-routeCum[idx],diff};if(travelled>1200)break;}return null;}
function updateRouteGuidance(p){const n=nearestRouteIndex(p);if(n.idx<0)return;const remaining=Math.max(0,routeTotal-routeCum[n.idx]);
$("remaining").textContent=(remaining/1000).toFixed(1)+" km";$("offRoute").textContent=Math.round(n.dist)+" m";
$("offRoute").className=n.dist>60?"danger":n.dist>30?"warn":"ok";const turn=findNextTurn(n.idx);
if(turn){const m=Math.max(0,Math.round(turn.distance));$("turnDistance").textContent=m<1000?m+" m":(m/1000).toFixed(1)+" km";
if(turn.diff>0){$("turnIcon").textContent=turn.diff>110?"↶":"↰";$("turnText").textContent=turn.diff>110?"Scharf links":"Links abbiegen";}
else{$("turnIcon").textContent=turn.diff<-110?"↷":"↱";$("turnText").textContent=turn.diff<-110?"Scharf rechts":"Rechts abbiegen";}}
else{$("turnIcon").textContent="↑";$("turnText").textContent=remaining<80?"Ziel erreicht":"Route weiter folgen";
$("turnDistance").textContent=remaining<80?"":Math.round(Math.min(remaining,999))+" m";}if(n.dist>60)$("mapInfo").textContent="Achtung: Route verlassen";}

$("startBtn").onclick=()=>{if(!navigator.geolocation){$("message").textContent="Dieser Browser unterstützt kein GPS.";return;}
running=true;startTime=Date.now();lastAccepted=null;$("startBtn").disabled=true;$("stopBtn").disabled=false;$("gpsStatus").textContent="GPS wird gesucht …";
timer=setInterval(updateTimer,1000);watchId=navigator.geolocation.watchPosition(pos=>{const c=pos.coords,acc=c.accuracy||999,kmh=(c.speed!=null&&c.speed>=0)?c.speed*3.6:0;
$("accuracy").textContent=Math.round(acc)+" m";$("position").textContent=c.latitude.toFixed(5)+", "+c.longitude.toFixed(5);$("speed").textContent=kmh.toFixed(1);
$("gpsStatus").textContent="GPS aktiv";updateMap(c.latitude,c.longitude);const p=[c.latitude,c.longitude];
if(lastAccepted){const d=hav(lastAccepted,p),moving=(kmh>=1.5)||(d>=8);if(acc<=35&&d>=3&&d<=120&&moving)totalMeters+=d;}
if(acc<=35)lastAccepted=p;$("distance").textContent=(totalMeters/1000).toFixed(2)+" km";},err=>{$("gpsStatus").textContent="GPS-Fehler";
$("message").textContent=err.code===1?"Standortzugriff wurde nicht erlaubt.":"GPS-Position konnte nicht bestimmt werden.";},{enableHighAccuracy:true,maximumAge:500,timeout:15000});};

$("stopBtn").onclick=()=>{running=false;clearInterval(timer);if(watchId!==null)navigator.geolocation.clearWatch(watchId);watchId=null;
$("speed").textContent="0.0";$("gpsStatus").textContent="Fahrt gestoppt";$("startBtn").disabled=false;$("stopBtn").disabled=true;};
$("resetBtn").onclick=()=>{if(running)$("stopBtn").click();totalMeters=0;startTime=null;lastAccepted=null;track=[];
$("distance").textContent="0.00 km";$("rideTime").textContent="00:00:00";$("accuracy").textContent="-- m";$("position").textContent="--";
$("gpsStatus").textContent="GPS noch nicht gestartet";if(trackLine)trackLine.setLatLngs([]);};

function page(which){const nav=which==="nav";$("ridePage").classList.toggle("hidden",nav);$("navPage").classList.toggle("hidden",!nav);
$("rideBtn").classList.toggle("active",!nav);$("navBtn").classList.toggle("active",nav);if(nav){initMap();setTimeout(()=>map.invalidateSize(),100);
if(currentLatLng)map.setView(currentLatLng,17);else if(route.length)map.fitBounds(gpxLine.getBounds(),{padding:[20,20]});}}
$("rideBtn").onclick=()=>page("ride");$("navBtn").onclick=()=>page("nav");
$("centerBtn").onclick=()=>{initMap();if(currentLatLng)map.setView(currentLatLng,17);else if(route.length)map.fitBounds(gpxLine.getBounds(),{padding:[20,20]});};
$("followBtn").onclick=()=>{followMode=!followMode;$("followBtn").textContent="Auto-Folgen: "+(followMode?"AN":"AUS");$("followBtn").classList.toggle("activeTool",followMode);};
$("bikeBtn").onclick=()=>alert("Bike-Anbindung folgt nach den Fahrtests.");$("setupBtn").onclick=()=>alert("Setup wird später erweitert.");

$("gpxBtn").onclick=()=>{$("gpxInput").value="";$("gpxInput").click();};

$("gpxInput").addEventListener("change",async e=>{
  const file=e.target.files&&e.target.files[0];
  if(!file){$("message").textContent="Keine Datei ausgewählt.";return;}
  try{
    const txt=await file.text();
    if(!txt || (!txt.includes("<gpx") && !txt.includes("<trkpt") && !txt.includes("<rtept"))) throw new Error("Kein GPX");
    const xml=new DOMParser().parseFromString(txt,"application/xml");
    if(xml.querySelector("parsererror")) throw new Error("XML");
    const parse=[...xml.querySelectorAll("trkpt,rtept")].map(n=>[
      +n.getAttribute("lat"),+n.getAttribute("lon")
    ]).filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1]));
    if(parse.length<2)throw new Error("Keine Punkte");
    route=parse;lastNearest=0;
    const nameNode=xml.querySelector("trk > name, rte > name, metadata > name");
    routeName=(nameNode&&nameNode.textContent?nameNode.textContent.trim():"")||file.name.replace(/\.[^.]+$/,"");
    buildRouteCum();initMap();if(gpxLine)map.removeLayer(gpxLine);
    gpxLine=L.polyline(route,{weight:6,dashArray:"10 7"}).addTo(map);map.fitBounds(gpxLine.getBounds(),{padding:[20,20]});
    $("remaining").textContent=(routeTotal/1000).toFixed(1)+" km";$("offRoute").textContent="-- m";$("turnIcon").textContent="↑";
    $("turnText").textContent="Route geladen";$("turnDistance").textContent=(routeTotal/1000).toFixed(1)+" km gesamt";
    $("mapInfo").textContent=routeName+" • "+route.length+" Punkte";$("message").textContent="GPX geladen: "+file.name;
  }catch(err){
    $("message").textContent="Die ausgewählte Datei ist keine lesbare GPX-Datei.";
  }
});