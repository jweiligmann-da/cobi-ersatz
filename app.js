let watchId=null, running=false, lastPos=null, totalMeters=0, startTime=null, timer=null;
const $=id=>document.getElementById(id);
function clock(){ $("clock").textContent=new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}); }
setInterval(clock,1000); clock();

function haversine(a,b){
 const R=6371000, rad=x=>x*Math.PI/180;
 const dLat=rad(b.latitude-a.latitude), dLon=rad(b.longitude-a.longitude);
 const x=Math.sin(dLat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dLon/2)**2;
 return 2*R*Math.asin(Math.sqrt(x));
}
function timeText(ms){
 const s=Math.floor(ms/1000), h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60;
 return [h,m,sec].map(v=>String(v).padStart(2,"0")).join(":");
}
function updateTimer(){ if(running && startTime) $("rideTime").textContent=timeText(Date.now()-startTime); }

$("startBtn").onclick=()=>{
 if(!navigator.geolocation){ $("message").textContent="Dieser Browser unterstützt kein GPS."; return; }
 running=true; startTime=Date.now(); lastPos=null;
 $("startBtn").disabled=true; $("stopBtn").disabled=false;
 $("gpsStatus").textContent="GPS wird gesucht …";
 timer=setInterval(updateTimer,1000);
 watchId=navigator.geolocation.watchPosition(pos=>{
   const c=pos.coords;
   $("accuracy").textContent=Math.round(c.accuracy)+" m";
   $("position").textContent=c.latitude.toFixed(5)+", "+c.longitude.toFixed(5);
   let kmh=(c.speed!=null && c.speed>=0)?c.speed*3.6:0;
   $("speed").textContent=kmh.toFixed(1);
   $("gpsStatus").textContent="GPS aktiv";
   if(lastPos && c.accuracy<=50){
     const d=haversine(lastPos,c);
     if(d<200) totalMeters+=d;
   }
   lastPos={latitude:c.latitude,longitude:c.longitude};
   $("distance").textContent=(totalMeters/1000).toFixed(2)+" km";
 },err=>{
   $("gpsStatus").textContent="GPS-Fehler";
   $("message").textContent=err.code===1 ? "Standortzugriff wurde nicht erlaubt." : "GPS-Position konnte nicht bestimmt werden.";
 },{enableHighAccuracy:true,maximumAge:1000,timeout:15000});
};

$("stopBtn").onclick=()=>{
 running=false; clearInterval(timer);
 if(watchId!==null) navigator.geolocation.clearWatch(watchId);
 watchId=null; $("speed").textContent="0.0"; $("gpsStatus").textContent="Fahrt gestoppt";
 $("startBtn").disabled=false; $("stopBtn").disabled=true;
};
$("resetBtn").onclick=()=>{
 if(running) $("stopBtn").click();
 totalMeters=0; startTime=null; lastPos=null;
 $("distance").textContent="0.00 km"; $("rideTime").textContent="00:00:00";
 $("accuracy").textContent="-- m"; $("position").textContent="--"; $("gpsStatus").textContent="GPS noch nicht gestartet";
};
$("navBtn").onclick=()=>alert("Navigation kommt in V3: Karte, GPX und Routenführung.");
$("bikeBtn").onclick=()=>alert("Bike-Anbindung wird in einer späteren Stufe ergänzt.");
$("setupBtn").onclick=()=>alert("Setup-Bereich wird weiter ausgebaut.");
