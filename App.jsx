import { useState, useEffect, useCallback } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, ComposedChart, Line } from "recharts";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

const ALLOWED_EMAILS = ["marcosforti618@gmail.com","aldanamolinari93@gmail.com"];

const firebaseConfig = {
  apiKey: "AIzaSyB9SC4vnKYCxQBRSv6mPaWGMAZ8c1S2SLU",
  authDomain: "gastos-am.firebaseapp.com",
  projectId: "gastos-am",
  storageBucket: "gastos-am.firebasestorage.app",
  messagingSenderId: "807893892687",
  appId: "1:807893892687:web:0f83eb118757165098343a"
};
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const auth = getAuth(fbApp);
const provider = new GoogleAuthProvider();

async function fbGet(key) {
  try {
    if(key === "gastos") {
      // Read chunked gastos
      var snap0 = await getDoc(doc(db, "gastos_am", "gastos_0"));
      if(!snap0.exists()) {
        // fallback: try single doc
        var snap = await getDoc(doc(db, "gastos_am", "gastos"));
        return snap.exists() ? snap.data().value : null;
      }
      var chunks = [], i = 0;
      while(true) {
        var s = await getDoc(doc(db, "gastos_am", "gastos_"+i));
        if(!s.exists()) break;
        chunks.push(JSON.parse(s.data().value));
        i++;
      }
      return JSON.stringify([].concat.apply([], chunks));
    }
    var snap = await getDoc(doc(db, "gastos_am", key));
    return snap.exists() ? snap.data().value : null;
  } catch(e) { return null; }
}
async function fbSet(key, value) {
  try {
    if(key === "gastos") {
      // Split into chunks of ~400 items
      var arr = JSON.parse(value);
      var CHUNK = 400;
      var numChunks = Math.ceil(arr.length / CHUNK);
      for(var i = 0; i < numChunks; i++) {
        var chunk = arr.slice(i*CHUNK, (i+1)*CHUNK);
        await setDoc(doc(db, "gastos_am", "gastos_"+i), {value: JSON.stringify(chunk)});
      }
      // Delete any old extra chunks
      for(var j = numChunks; j < numChunks+5; j++) {
        var old = await getDoc(doc(db, "gastos_am", "gastos_"+j));
        if(!old.exists()) break;
        await setDoc(doc(db, "gastos_am", "gastos_"+j), {value: "[]"});
      }
      return;
    }
    await setDoc(doc(db, "gastos_am", key), {value});
  } catch(e) {}
}

const CATEGORIAS = ["Supermercado","Departamento","Nafta","Préstamos","Bienes","Viajes","Regalos","Salidas","Delivery","Meriendas","Farmacia","Tina&Coca♥","Verita♥♥","Otros gastos auto","Descuentos","Gascon","Terreno","Casamiento","Otros"];
const PERSONAS   = ["Marcos","Aldana","Muni","Regalo"];
const MEDIOS     = ["Crédito","Débito","Efectivo","Transferencia","MP","BSF"];
const MESES      = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const COLORES    = {"Supermercado":"#1D9E75","Departamento":"#185FA5","Nafta":"#BA7517","Préstamos":"#D4537E","Bienes":"#7F77DD","Viajes":"#378ADD","Regalos":"#D85A30","Salidas":"#E24B4A","Delivery":"#EF9F27","Meriendas":"#97C459","Farmacia":"#5DCAA5","Tina&Coca♥":"#993556","Verita♥♥":"#E8303A","Otros gastos auto":"#888780","Descuentos":"#B4B2A9","Gascon":"#533AB7","Terreno":"#639922","Casamiento":"#9B1C2E","Otros":"#5F5E5A"};
const CLABELS    = {};
function cl(x){return CLABELS[x]||x;}

const TODAY = new Date();
const FORM0 = {mes:TODAY.getMonth()+1,anio:TODAY.getFullYear(),descripcion:"",cuota:"",monto:"",etiqueta:"",nombre:"Marcos",medio:"Crédito"};

function mk(m,a){return a+"-"+String(m).padStart(2,"0");}
function parseMonto(raw){
  if(!raw)return 0;
  var s=String(raw).trim().replace(/\s/g,""),neg=s[0]==="-",abs=s.replace(/-/g,""),val;
  if(abs.includes(",")&&abs.includes("."))val=parseFloat(abs.replace(/\./g,"").replace(",","."));
  else if(abs.includes(","))val=parseFloat(abs.replace(",","."));
  else if(abs.includes(".")){var ad=abs.split(".").pop();val=ad.length>3?parseFloat(abs):parseFloat(abs.replace(/\./g,""));}
  else val=parseFloat(abs);
  return neg?-(val||0):(val||0);
}
function parseDiario(txt){
  // Parses daily DD/MM/YYYY\tvalor strip and returns monthly averages
  var byMonth={};
  txt.trim().split("\n").forEach(function(l){
    var p=l.trim().split(/\t/);if(p.length<2)return;
    var v=parseFloat(p[1].trim().replace(/\./g,"").replace(",","."));if(isNaN(v)||v<=0)return;
    var d=p[0].trim().split("/");if(d.length<3)return;
    var mes=parseInt(d[1]),anio=parseInt(d[2]);if(!mes||!anio)return;
    var k=mk(mes,anio);
    if(!byMonth[k])byMonth[k]=[];
    byMonth[k].push(v);
  });
  var result={};
  Object.keys(byMonth).forEach(function(k){
    var vals=byMonth[k];
    result[k]=vals.reduce(function(s,v){return s+v;},0)/vals.length;
  });
  return result;
}
function parseCER(txt){return parseDiario(txt);}
function parseTC(txt){return parseDiario(txt);}
function parseMesAnio(r0,r1){
  var mm={ene:1,feb:2,mar:3,abr:4,may:5,jun:6,jul:7,ago:8,sept:9,sep:9,oct:10,nov:11,dic:12};
  if(r0&&r0.includes("-")){var p=r0.split("-"),m=mm[p[0].toLowerCase()],a=p[1].length===2?parseInt("20"+p[1]):parseInt(p[1]);if(m&&a)return{mes:m,anio:a};}
  return{mes:parseInt(r0)||TODAY.getMonth()+1,anio:parseInt(r1)||TODAY.getFullYear()};
}

const CSS = `
.gr{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#F5F3EF;min-height:100vh;color:#1a1a2e;}
.gr *{box-sizing:border-box;}
.hdr{background:linear-gradient(135deg,#1a1f3a 0%,#2d3561 60%,#3d4e8a 100%);padding:24px 24px 28px;position:relative;overflow:hidden;}
.title{font-size:22px;font-weight:700;color:#fff;margin:0 0 2px;}
.accent{color:#C49A6C;}
.badge{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.18);border-radius:999px;padding:4px 12px;font-size:11px;color:rgba(255,255,255,0.8);font-weight:500;}
.sub{font-size:12px;color:rgba(255,255,255,0.55);margin:0;}
.mw{background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.18);border-radius:12px;padding:12px 14px;min-width:175px;}
.mp{font-size:11px;padding:4px 10px;border-radius:999px;cursor:pointer;border:1px solid rgba(255,255,255,0.2);background:transparent;color:rgba(255,255,255,0.7);font-weight:500;font-family:inherit;}
.mp.on{background:#C49A6C;border-color:#C49A6C;color:#fff;font-weight:700;}
.tabs{display:flex;border-bottom:1.5px solid #E8E4DD;background:#F5F3EF;padding:0 4px;}
.tab{font-size:13px;padding:12px 16px;border:none;background:transparent;cursor:pointer;border-bottom:2.5px solid transparent;color:#9CA3AF;font-weight:500;font-family:inherit;margin-bottom:-1.5px;}
.tab.on{color:#1a1f3a;border-bottom-color:#C49A6C;font-weight:600;}
.nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:16px 0;padding:12px 16px;background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,0.06);}
.navbtn{font-size:17px;line-height:1;padding:4px 12px;cursor:pointer;border:1.5px solid #E2DDD6;border-radius:8px;background:#F5F3EF;color:#1a1f3a;font-family:inherit;}
.pill{font-size:12px;padding:5px 14px;border-radius:999px;cursor:pointer;border:1.5px solid #E2DDD6;background:transparent;color:#6B7280;font-weight:500;font-family:inherit;}
.pill.on{background:#1a1f3a;border-color:#1a1f3a;color:#fff;font-weight:600;}
.cd{background:#1a1f3a;border-radius:14px;padding:16px 18px;}
.cd .l{font-size:11px;color:rgba(255,255,255,0.55);margin:0;font-weight:500;letter-spacing:0.04em;text-transform:uppercase;}
.cd .v{font-size:20px;font-weight:700;color:#fff;margin:4px 0 2px;}
.cd .s{font-size:11px;color:rgba(255,255,255,0.4);margin:0;}
.cw{background:#fff;border-radius:14px;padding:16px 18px;box-shadow:0 1px 4px rgba(0,0,0,0.06);}
.cw .l{font-size:11px;color:#9CA3AF;margin:0;font-weight:500;letter-spacing:0.04em;text-transform:uppercase;}
.cw .v{font-size:18px;font-weight:600;color:#1a1f3a;margin:4px 0 2px;}
.cw .s{font-size:11px;color:#B8B4AD;margin:0;}
.sec{font-size:12px;font-weight:600;color:#9CA3AF;letter-spacing:0.06em;text-transform:uppercase;margin:0 0 12px;}
.addbtn{display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:#1a1f3a;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;margin-top:16px;}
.plus{background:#C49A6C;color:#fff;width:20px;height:20px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;line-height:1;}
.hrow{padding:12px 16px;cursor:pointer;border-radius:12px;border:1.5px solid #E8E4DD;background:#fff;margin-bottom:8px;}
.hrow.on{border-color:#3D4E8A;background:#F0F2FA;}
.ntf{padding:10px 16px;background:#C49A6C;color:#fff;border-radius:10px;font-size:13px;font-weight:600;margin-bottom:14px;}
.body{padding:0 16px 32px;}
`;

const thS={fontSize:11,color:"#9CA3AF",fontWeight:600,padding:"8px 10px",textAlign:"left",whiteSpace:"nowrap",borderBottom:"1px solid #F0EDE8",letterSpacing:"0.04em",textTransform:"uppercase",cursor:"pointer"};
const tdS={fontSize:13,padding:"9px 10px",borderBottom:"1px solid #F7F5F2",color:"#1a1a2e"};

function AnalisSection(gastos,anCat,setAnCat,anMes,setAnMes,anRango,setAnRango,anMA,setAnMA,fmt,fmtK,convVal,cl,CATEGORIAS,COLORES,MESES,mk,thS,tdS,btnSt,Cell) {
  var gCat=gastos.filter(function(g){return g.etiqueta===anCat&&g.monto>0;});
  var mksCat=[],seC={};
  gCat.forEach(function(g){var k=mk(g.mes,g.anio);if(!seC[k]){seC[k]=1;mksCat.push(k);}});
  // Ultimos N meses calendario desde hoy
  var rKs=(function(){
    var result=[];
    var d=new Date();
    for(var i=anRango-1;i>=0;i--){
      var m2=new Date(d.getFullYear(),d.getMonth()-i,1);
      result.push(mk(m2.getMonth()+1,m2.getFullYear()));
    }
    return result;
  })();
  // Para el grafico: solo meses con datos de esta categoria
  var rKsBar=mksCat.slice(-anRango);

  // Todos los meses de la cat para calcular MA con datos anteriores al rango
  var allMksCat=mksCat.slice().sort();
  var barAnD=rKsBar.map(function(k,idx){
    var pts=k.split("-"),bm=parseInt(pts[1]),ba=parseInt(pts[0]);
    var tot=gCat.filter(function(g){return g.mes===bm&&g.anio===ba;}).reduce(function(s,g){var v=convVal(g.monto,k);return s+(v||0);},0);
    // Media movil 12 meses: tomar los 12 meses anteriores (incluyendo este) de allMksCat
    var idxAll=allMksCat.indexOf(k);
    var maWindow=allMksCat.slice(Math.max(0,idxAll-(anMA-1)),idxAll+1);
    var maVals=maWindow.map(function(mk2){
      var p2=mk2.split("-"),bm2=parseInt(p2[1]),ba2=parseInt(p2[0]);
      return gCat.filter(function(g){return g.mes===bm2&&g.anio===ba2;}).reduce(function(s,g){var v=convVal(g.monto,mk2);return s+(v||0);},0);
    });
    var ma=maWindow.length>=anMA?Math.round(maVals.reduce(function(s,v){return s+v;},0)/maVals.length):null;
    return{mes:MESES[bm-1]+"'"+String(ba).slice(2),total:tot,ma:ma,_mk:k};
  });
  var descSet={};gCat.forEach(function(g){descSet[g.descripcion]=(descSet[g.descripcion]||0)+g.monto;});
  var descs=Object.keys(descSet).sort(function(a,b){return descSet[b]-descSet[a];});
  var muchasDescs=descs.length>8;
  var breakdownRows=descs.map(function(desc){
    var row={desc:desc,totalRaw:0,hasData:false};
    rKs.forEach(function(k){
      var pts=k.split("-"),bm=parseInt(pts[1]),ba=parseInt(pts[0]);
      var rawSum=gCat.filter(function(g){return g.descripcion===desc&&g.mes===bm&&g.anio===ba;}).reduce(function(s,g){return s+g.monto;},0);
      row[k]=rawSum;
      row.totalRaw+=rawSum;
      if(rawSum>0) row.hasData=true;
    });
    return row;
  }).sort(function(a,b){return b.totalRaw-a.totalRaw;});
  // Columnas de la tabla: si hay mes seleccionado, solo ese; si no, todos
  var tableCols = anMes ? [anMes] : rKs;
  var detalleMes=anMes?gCat.filter(function(g){return mk(g.mes,g.anio)===anMes;}):[];
  var detalleLabel=anMes?(function(){var pts=anMes.split("-");return MESES[parseInt(pts[1])-1]+" "+pts[0];}()):"";

  return (
    <div>
      <p style={{fontSize:12,fontWeight:600,color:"#9CA3AF",letterSpacing:"0.06em",textTransform:"uppercase",margin:"0 0 10px"}}>Categoria</p>
      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:20}}>
        {CATEGORIAS.map(function(c){
          var act=anCat===c;
          return (
            <button key={c} onClick={function(){setAnCat(c);setAnMes(null);}}
              style={{fontSize:11,padding:"5px 12px",borderRadius:999,cursor:"pointer",border:act?"1.5px solid "+(COLORES[c]||"#888"):"1px solid #E2DDD6",background:act?(COLORES[c]||"#888"):"transparent",color:act?"#fff":"#6B7280",fontWeight:act?600:400,fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:5}}>
              {!act && <span style={{width:7,height:7,borderRadius:2,flexShrink:0,background:COLORES[c]||"#888",display:"inline-block"}}/>}
              {cl(c)}
            </button>
          );
        })}
      </div>

      {gCat.length===0 ? (
        <p style={{fontSize:13,color:"#9CA3AF"}}>Sin datos para esta categoria.</p>
      ) : (
        <div>
          {muchasDescs && (
            <div style={{padding:"10px 14px",background:"#FEF3C7",borderRadius:10,marginBottom:16,fontSize:12,color:"#92400E"}}>
              <strong>Tip:</strong> Esta categoria tiene {descs.length} descripciones distintas. Estandarizar los nombres mejora el tracking en el tiempo.
            </div>
          )}

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
            <p style={{fontSize:12,fontWeight:600,color:"#9CA3AF",letterSpacing:"0.06em",textTransform:"uppercase",margin:0}}>Evolucion de {cl(anCat)}</p>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <div style={{display:"flex",gap:4,alignItems:"center"}}>
                <span style={{fontSize:10,color:"#B8B4AD",fontWeight:600,letterSpacing:"0.05em",textTransform:"uppercase"}}>Rango</span>
                {[6,12,24,36].map(function(r){return <button key={r} onClick={function(){setAnRango(r);setAnMes(null);}} style={btnSt(anRango===r)}>{r}m</button>;})}
              </div>
              <div style={{width:1,height:18,background:"#E2DDD6"}}/>
              <div style={{display:"flex",gap:4,alignItems:"center"}}>
                <span style={{fontSize:10,color:"#B8B4AD",fontWeight:600,letterSpacing:"0.05em",textTransform:"uppercase"}}>MA</span>
                {[3,6,12].map(function(r){return <button key={r} onClick={function(){setAnMA(r);}} style={btnSt(anMA===r)}>{r}m</button>;})}
              </div>
            </div>
          </div>
          <div style={{background:"#fff",borderRadius:14,padding:"16px 8px 8px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",height:260,marginBottom:8}}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={barAnD} margin={{top:4,right:8,left:4,bottom:28}} onClick={function(e){if(e&&e.activePayload&&e.activePayload[0]){var k=e.activePayload[0].payload._mk;setAnMes(anMes===k?null:k);}}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE8" vertical={false}/>
                <XAxis dataKey="mes" tick={{fontSize:10,fill:"#9CA3AF"}} angle={-45} textAnchor="end" interval={0}/>
                <YAxis tick={{fontSize:10,fill:"#9CA3AF"}} tickFormatter={function(v){return v>=1000000?"$"+(v/1000000).toFixed(1)+"M":v>=1000?"$"+(v/1000).toFixed(0)+"k":"$"+v;}} width={52}/>
                <Tooltip formatter={function(value,name){
                  if(name==="ma") return ["$"+Math.round(value).toLocaleString("es-AR"),"MM "+anMA+"m"];
                  return ["$"+Math.round(value).toLocaleString("es-AR"),"Total"];
                }} contentStyle={{fontSize:12,borderRadius:8,border:"1px solid #E2DDD6",background:"#fff",color:"#1a1a2e"}} cursor={{fill:"rgba(0,0,0,0.05)"}}/>
                <Bar dataKey="total" stroke="none" radius={[3,3,0,0]}>
                  {barAnD.map(function(entry){
                    return <Cell key={entry._mk} fill={entry._mk===anMes?"#1a1f3a":(COLORES[anCat]||"#185FA5")} opacity={anMes&&entry._mk!==anMes?0.4:1}/>;
                  })}
                </Bar>
                <Line dataKey="ma" type="monotone" stroke="#C49A6C" strokeWidth={2} dot={false} strokeDasharray="4 2" connectNulls={false} name="ma"/>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div style={{display:"flex",gap:16,justifyContent:"center",marginBottom:16,fontSize:11,color:"#6B7280"}}>
            <span style={{display:"inline-flex",alignItems:"center",gap:5}}><span style={{width:12,height:10,borderRadius:2,background:COLORES[anCat]||"#888",display:"inline-block"}}/> Total mensual</span>
            <span style={{display:"inline-flex",alignItems:"center",gap:5}}><span style={{width:16,height:2,background:"#C49A6C",display:"inline-block",borderTop:"2px dashed #C49A6C"}}/> Media móvil {anMA}m</span>
          </div>
          <p style={{fontSize:11,color:"#9CA3AF",textAlign:"center",marginBottom:24}}>Click en una barra para ver el detalle de ese mes</p>

          {rKs.length>0 && !anMes && (
            <div style={{marginBottom:24}}>
              <p style={{fontSize:12,fontWeight:600,color:"#9CA3AF",letterSpacing:"0.06em",textTransform:"uppercase",margin:"0 0 10px"}}>Por descripcion — ultimos {anRango} meses</p>
              <div style={{background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead>
                      <tr style={{background:"#FAFAF9"}}>
                        <th style={thS}>Descripcion</th>
                        {rKs.map(function(k){var pts=k.split("-");return <th key={k} style={Object.assign({},thS,{textAlign:"right",cursor:"pointer"})} onClick={function(){setAnMes(k);}}>{MESES[parseInt(pts[1])-1]+"'"+String(parseInt(pts[0])).slice(2)}</th>;})}
                        <th style={Object.assign({},thS,{textAlign:"right"})}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {breakdownRows.filter(function(row){return row.hasData;}).map(function(row){
                        return (
                          <tr key={row.desc}>
                            <td style={Object.assign({},tdS,{fontWeight:500,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"})}>{row.desc}</td>
                            {rKs.map(function(k){
                              var pts=k.split("-"),bm=parseInt(pts[1]),ba=parseInt(pts[0]);
                              var v=row[k]||0;
                              return <td key={k} style={Object.assign({},tdS,{textAlign:"right",color:v>0?"#1a1a2e":"#D1D5DB"})}>{v>0?fmtK(v,bm,ba):"-"}</td>;
                            })}
                            <td style={Object.assign({},tdS,{textAlign:"right",fontWeight:600,color:"#1a1f3a"})}>{row.totalRaw>0?fmt(row.totalRaw):"-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {anMes && (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <p style={{fontSize:12,fontWeight:600,color:"#9CA3AF",letterSpacing:"0.06em",textTransform:"uppercase",margin:0}}>Detalle — {detalleLabel}</p>
                <button onClick={function(){setAnMes(null);}} style={{fontSize:11,padding:"3px 10px",borderRadius:999,border:"1px solid #E2DDD6",background:"transparent",color:"#9CA3AF",cursor:"pointer",fontFamily:"inherit"}}>x Limpiar</button>
              </div>
              {detalleMes.length===0 ? (
                <p style={{fontSize:13,color:"#9CA3AF"}}>Sin gastos en este mes.</p>
              ) : (function(){
                  var anMesPts=anMes?anMes.split("-"):[];
                  var anMesBm=anMesPts.length>1?parseInt(anMesPts[1]):1;
                  var anMesBa=anMesPts.length>0?parseInt(anMesPts[0]):TODAY.getFullYear();
                  var agrup={};
                  detalleMes.forEach(function(g){
                    var k=g.descripcion;
                    if(!agrup[k]) agrup[k]={descripcion:g.descripcion,monto:0,count:0,quien:g.nombre,medio:g.medio};
                    agrup[k].monto+=g.monto;
                    agrup[k].count+=1;
                    if(agrup[k].quien!==g.nombre) agrup[k].quien="Varios";
                  });
                  var rows=Object.keys(agrup).map(function(k){return agrup[k];}).sort(function(a,b){return b.monto-a.monto;});
                  return (
                    <div style={{background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
                      <table style={{width:"100%",borderCollapse:"collapse"}}>
                        <thead>
                          <tr style={{background:"#FAFAF9"}}>
                            <th style={thS}>Descripcion</th>
                            <th style={thS}>Quien</th>
                            <th style={Object.assign({},thS,{textAlign:"right"})}>Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(function(r){
                            return (
                              <tr key={r.descripcion}>
                                <td style={tdS}>
                                  {r.descripcion}
                                  {r.count>1 && <span style={{fontSize:11,color:"#9CA3AF",marginLeft:6}}>x{r.count}</span>}
                                </td>
                                <td style={tdS}>{r.quien}</td>
                                <td style={Object.assign({},tdS,{fontWeight:600,textAlign:"right"})}>{fmtK(r.monto,anMesBm,anMesBa)}</td>
                              </tr>
                            );
                          })}
                          <tr style={{background:"#F5F3EF"}}>
                            <td style={Object.assign({},tdS,{fontWeight:700})} colSpan={2}>Total</td>
                            <td style={Object.assign({},tdS,{fontWeight:700,textAlign:"right"})}>{fmtK(detalleMes.reduce(function(s,g){return s+g.monto;},0),anMesBm,anMesBa)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })()
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function App(){
  var [user,setUser]=useState(null);
  var [authLoading,setAuthLoading]=useState(true);
  var [authError,setAuthError]=useState("");
  var [gastos,setG]=useState([]);
  var [vista,setV]=useState("resumen");
  var [fMes,setFM]=useState(TODAY.getMonth()+1);
  var [fAnio,setFA]=useState(TODAY.getFullYear());
  var [fP,setFP]=useState("Todos");
  var [fC,setFC]=useState("Todas");
  var [bus,setBus]=useState("");
  var [form,setForm]=useState(FORM0);
  var [showF,setShowF]=useState(false);
  var [editId,setEI]=useState(null);
  var [sc,setSC]=useState(null);
  var [sd,setSD]=useState(1);
  var [mon,setMon]=useState("ARS");
  var [tc,setTC]=useState({});
  var [tcM,setTCM]=useState("");
  var [cer,setCer]=useState({});
  var [cerM,setCerM]=useState("");
  var [rango,setRango]=useState(12);
  var [pdfF,setPdfF]=useState("Tarjeta de credito");
  var [pdfP,setPdfP]=useState("Marcos");
  var [pdfMes,setPdfMes]=useState(TODAY.getMonth()+1);
  var [pdfAnio,setPdfAnio]=useState(TODAY.getFullYear());
  var [pdfL,setPdfL]=useState(false);
  var [pdfR,setPdfR]=useState(null);
  var [pdfE,setPdfE]=useState("");
  var [csv,setCSV]=useState("");
  var [cerT,setCerT]=useState("");
  var [tcT,setTcT]=useState("");
  var [expT,setExpT]=useState("");
  var [reporteHtml,setReporteHtml]=useState("");
  var [msg,setMsg]=useState("");
  var [anCat,setAnCat]=useState(CATEGORIAS[0]);
  var [anMes,setAnMes]=useState(null);
  var [anRango,setAnRango]=useState(12);
  var [anMA,setAnMA]=useState(12);
  var [grafMounted,setGrafMounted]=useState(false);
  var [anMounted,setAnMounted]=useState(false);

  useEffect(function(){
    return onAuthStateChanged(auth,function(u){
      setUser(u);
      setAuthLoading(false);
      if(u && ALLOWED_EMAILS.includes(u.email)){
        fbGet("gastos").then(function(v){if(v)setG(JSON.parse(v));});
        fbGet("tc").then(function(v){if(v)setTC(JSON.parse(v));});
        fbGet("cer").then(function(v){if(v)setCer(JSON.parse(v));});
      }
    });
  },[]);

  var saveG=useCallback(function(a){setG(a);fbSet("gastos",JSON.stringify(a));});
  var saveTC=useCallback(function(c){setTC(c);fbSet("tc",JSON.stringify(c));});
  var saveCer=useCallback(function(c){setCer(c);fbSet("cer",JSON.stringify(c));});

  function notify(t){setMsg(t);setTimeout(function(){setMsg("");},2500);}

  // derived
  var mD=[],seM={};
  gastos.forEach(function(g){var k=mk(g.mes,g.anio);if(!seM[k]){seM[k]=1;mD.push(k);}});
  mD.sort();
  var uMK=mD.length>0?mD[mD.length-1]:mk(TODAY.getMonth()+1,TODAY.getFullYear());
  var tcK=mk(fMes,fAnio);
  var tcV=tc[tcK]||(tcM?parseFloat(tcM):null);
  var tcX=mon==="USD"&&!tcV;
  var cerU=cer[uMK]||null;
  var cerX=mon==="CER"&&(!cer[mk(fMes,fAnio)]||!cerU);

  function fcer(m,a){var cm=cer[mk(m,a)];if(!cm||!cerU)return null;return cerU/cm;}
  function fmt(v){
    if(mon==="USD"){if(!tcV)return"—";var c=v/tcV;return(c<0?"-":"")+"U$S "+Math.round(Math.abs(c)).toLocaleString("es-AR");}
    if(mon==="CER"){var f=fcer(fMes,fAnio);if(!f)return"—";var aj=v*f;return(aj<0?"-":"")+"$ "+Math.round(Math.abs(aj)).toLocaleString("es-AR");}
    return(v<0?"-":"")+"$ "+Math.round(Math.abs(v)).toLocaleString("es-AR");
  }
  function fmtK(v,m,a){
    if(mon==="USD"){var t=tc[mk(m,a)];if(!t)return"—";var c=v/t;return(c<0?"-":"")+"U$S "+Math.round(Math.abs(c)).toLocaleString("es-AR");}
    if(mon==="CER"){var f=fcer(m,a);if(!f)return"—";var aj=v*f;return(aj<0?"-":"")+"$ "+Math.round(Math.abs(aj)).toLocaleString("es-AR");}
    return(v<0?"-":"")+"$ "+Math.round(Math.abs(v)).toLocaleString("es-AR");
  }
  function convVal(raw,mesK){
    if(mon==="USD"){var t=tc[mesK];return t?Math.round(raw/t):null;}
    if(mon==="CER"){var pts=mesK.split("-"),cm=cer[mesK];return cm&&cerU?Math.round(raw*cerU/cm):null;}
    return Math.round(raw);
  }

  function prev(){if(fMes===1){setFM(12);setFA(function(a){return a-1;});}else setFM(function(m){return m-1;});}
  function next(){if(fMes===12){setFM(1);setFA(function(a){return a+1;});}else setFM(function(m){return m+1;});}
  function storeTC(){var v=parseFloat(tcM);if(v>0){var n=Object.assign({},tc);n[tcK]=v;saveTC(n);setTCM("");}}
  function storeCer(){var v=parseFloat(cerM);if(v>0){var k=!cerU?uMK:mk(fMes,fAnio);var n=Object.assign({},cer);n[k]=v;saveCer(n);setCerM("");}}

  var gM=gastos.filter(function(g){return g.mes===fMes&&g.anio===fAnio;});
  var gBase=bus.trim()?gastos:gM;
  var gF=gBase.filter(function(g){return fP==="Todos"||g.nombre===fP;}).filter(function(g){return fC==="Todas"||g.etiqueta===fC;}).filter(function(g){if(!bus.trim())return true;return g.descripcion.toLowerCase().indexOf(bus.toLowerCase())>=0;});
  var gS=sc?gF.slice().sort(function(a,b){var va=a[sc],vb=b[sc];return typeof va==="number"?(va-vb)*sd:String(va).localeCompare(String(vb))*sd;}):gF;

  var totM=gM.reduce(function(s,g){return s+g.monto;},0);
  var totMa=gM.filter(function(g){return g.nombre==="Marcos";}).reduce(function(s,g){return s+g.monto;},0);
  var totAl=gM.filter(function(g){return g.nombre==="Aldana";}).reduce(function(s,g){return s+g.monto;},0);
  var totMu=gM.filter(function(g){return g.nombre==="Muni";}).reduce(function(s,g){return s+g.monto;},0);

  var cats=(function(){var m={};gM.filter(function(g){return fP==="Todos"||g.nombre===fP;}).forEach(function(g){m[g.etiqueta]=(m[g.etiqueta]||0)+g.monto;});return Object.keys(m).map(function(k){return[k,m[k]];}).sort(function(a,b){return b[1]-a[1];});})();

  var years=[],seY={};
  gastos.forEach(function(g){if(!seY[g.anio]){seY[g.anio]=1;years.push(g.anio);}});
  if(!seY[TODAY.getFullYear()])years.push(TODAY.getFullYear());
  years.sort(function(a,b){return b-a;});

  var saldo=(function(){var s=0;gastos.forEach(function(g){if(g.nombre==="Marcos")s+=g.monto;else if(g.nombre==="Aldana")s-=g.monto;});return s/2;})();

  var pM2=fMes===1?12:fMes-1,pA2=fMes===1?fAnio-1:fAnio;
  var tPrev={};gastos.filter(function(g){return g.mes===pM2&&g.anio===pA2;}).forEach(function(g){tPrev[g.etiqueta]=(tPrev[g.etiqueta]||0)+g.monto;});
  var tAct={};gM.forEach(function(g){tAct[g.etiqueta]=(tAct[g.etiqueta]||0)+g.monto;});
  function vPct(cat){var p=tPrev[cat]||0;if(!p)return null;return(((tAct[cat]||0)-p)/Math.abs(p))*100;}

  var allMK=mD.slice().sort(),rK=allMK.slice(-rango);
  var barD=rK.map(function(k){
    var pts=k.split("-"),bm=parseInt(pts[1]),ba=parseInt(pts[0]);
    var gg=gastos.filter(function(g){return g.mes===bm&&g.anio===ba&&g.monto>0;});
    var ma=0,al=0,mu=0;
    gg.forEach(function(g){
      var raw=g.monto;
      var v=mon==="USD"?(tc[k]?Math.round(raw/tc[k]):0):mon==="CER"?(cer[k]&&cerU?Math.round(raw*cerU/cer[k]):0):Math.round(raw);
      if(g.nombre==="Marcos")ma+=v;else if(g.nombre==="Aldana")al+=v;else if(g.nombre==="Muni")mu+=v;
    });
    return{mes:MESES[bm-1]+"'"+String(ba).slice(2),Marcos:ma,Aldana:al,Muni:mu};
  });

  var cSub="Pesos corrientes";
  if(mon==="CER"&&!cerX){var cp=uMK.split("-");cSub="Base "+MESES[parseInt(cp[1])-1]+" "+cp[0];}
  if(mon==="USD"&&!tcX&&tcV)cSub=(tc[tcK]?"TC MEP":"TC manual")+" $"+tcV.toLocaleString("es-AR");

  var cards=[
    {l:"Total del mes",v:fmt(totM),s:"todos los gastos",dark:true},
    {l:"Marcos",v:fmt(totMa),s:"gastos propios"},
    {l:"Aldana",v:fmt(totAl),s:"gastos propios"},
    {l:"Compartida",v:fmt(totMu),s:"Muni"},
    {l:"Saldo historico",v:fmt(Math.abs(saldo)),s:saldo===0?"Estan al dia":saldo>0?"A favor de Marcos":"A favor de Aldana"},
  ];

  function delG(id){saveG(gastos.filter(function(g){return g.id!==id;}));}
  function editG(g){setForm(Object.assign({},g));setEI(g.id);setShowF(true);}
  function guardar(next){
    if(!form.descripcion||!form.monto){notify("Completa descripcion y monto.");return;}
    if(!form.etiqueta){notify("Elegi una categoria.");return;}
    var m=parseFloat(String(form.monto).replace(",","."));
    if(editId){
      saveG(gastos.map(function(g){return g.id===editId?Object.assign({},form,{id:editId,monto:m}):g;}));
      setEI(null);setForm(FORM0);setShowF(false);notify("Gasto actualizado.");
    } else {
      saveG(gastos.concat([Object.assign({},form,{id:Date.now(),monto:m})]));
      if(next){setForm(Object.assign({},FORM0,{mes:form.mes,anio:form.anio,nombre:form.nombre,medio:form.medio}));notify("Gasto agregado.");}
      else{setForm(FORM0);setShowF(false);notify("Gasto agregado.");}
    }
  }
  function importCSV(){
    var lines=csv.trim().split("\n").filter(function(l){return l.trim();});
    if(!lines.length){notify("No hay datos.");return;}
    var fc=lines[0].split("\t").map(function(c){return c.trim();});
    var hasH=fc[0].toLowerCase()==="mes"||(fc[2]&&fc[2].toLowerCase().indexOf("descri")>=0);
    var dl=hasH?lines.slice(1):lines,nuevos=[];
    for(var i=0;i<dl.length;i++){
      var cols=dl[i].split("\t").map(function(c){return c.trim();});
      if(cols.length<5)continue;
      var ma=parseMesAnio(cols[0],cols[1]),monto=parseMonto(cols[4]);
      if(monto===0)continue;
      nuevos.push({id:Date.now()+i,mes:ma.mes,anio:ma.anio,descripcion:cols[2]||"Sin descripcion",cuota:cols[3]||"",monto:monto,etiqueta:cols[5]||"Otros",nombre:cols[6]||"Marcos",medio:cols[7]||"Otros"});
    }
    if(!nuevos.length){notify("No se encontraron filas validas.");return;}
    saveG(gastos.concat(nuevos));setCSV("");notify("Se importaron "+nuevos.length+" gastos.");
  }
  function importCER(){
    var p=parseCER(cerT),keys=Object.keys(p);
    if(!keys.length){notify("No se encontraron datos CER validos.");return;}
    var n=Object.assign({},cer);keys.forEach(function(k){n[k]=p[k];});
    saveCer(n);setCerT("");notify("CER cargado: "+keys.length+" meses (promedio mensual).");
  }
  function importTCStrip(){
    var p=parseTC(tcT),keys=Object.keys(p);
    if(!keys.length){notify("No se encontraron datos de TC validos.");return;}
    var n=Object.assign({},tc);keys.forEach(function(k){n[k]=Math.round(p[k]);});
    saveTC(n);setTcT("");notify("TC MEP cargado: "+keys.length+" meses (promedio mensual).");
  }
  function exportar(){
    if(!gastos.length){notify("No hay datos para exportar.");return;}
    var h=["Mes","Anio","Descripcion","Cuota","Monto","Categoria","Quien","Medio"];
    var rows=gastos.map(function(g){return[g.mes,g.anio,'"'+(g.descripcion||"").replace(/"/g,'""')+'"',g.cuota?'="'+g.cuota+'"':"",String(g.monto).replace(".",","),g.etiqueta||"",g.nombre||"",g.medio||""].join("\t");});
    setExpT(h.join("\t")+"\n"+rows.join("\n"));
  }

  function generarReporte(){
    // --- helpers locales ---
    function fmtR(v, mesK){
      // siempre CER para el reporte de evolucion; para resumen usa la moneda actual
      if(!mesK) return "$"+Math.round(Math.abs(v)).toLocaleString("es-AR");
      var cm=cer[mesK],cu=cerU;
      if(cm&&cu) return "$"+Math.round(Math.abs(v)*cu/cm).toLocaleString("es-AR");
      return "$"+Math.round(Math.abs(v)).toLocaleString("es-AR");
    }
    function fmtCur(v){
      if(mon==="USD"){if(!tcV)return"—";return"U$S "+Math.round(Math.abs(v/tcV)).toLocaleString("es-AR");}
      if(mon==="CER"){var f=fcer(fMes,fAnio);if(!f)return"—";return"$"+Math.round(Math.abs(v*f)).toLocaleString("es-AR");}
      return"$"+Math.round(Math.abs(v)).toLocaleString("es-AR");
    }

    // --- datos del mes ---
    var mesLabel=MESES[fMes-1]+" "+fAnio;
    var monLabel=mon==="USD"?"USD":mon==="CER"?"ARS constantes":"ARS";

    var totMa=gM.filter(function(g){return g.nombre==="Marcos";}).reduce(function(s,g){return s+g.monto;},0);
    var totAl=gM.filter(function(g){return g.nombre==="Aldana";}).reduce(function(s,g){return s+g.monto;},0);
    var saldoR=saldo;

    // --- pie chart SVG ---
    function buildPie(cats, total){
      if(!cats.length||total===0) return "<p style='color:#999;font-size:13px'>Sin datos</p>";
      var cx=150,cy=150,r=110,ir=55;
      var paths="",startAngle=-Math.PI/2;
      cats.filter(function(e){return e[1]>0;}).forEach(function(e){
        var pct=e[1]/total, angle=pct*2*Math.PI;
        var x1=cx+r*Math.cos(startAngle),y1=cy+r*Math.sin(startAngle);
        var x2=cx+r*Math.cos(startAngle+angle),y2=cy+r*Math.sin(startAngle+angle);
        var ix1=cx+ir*Math.cos(startAngle),iy1=cy+ir*Math.sin(startAngle);
        var ix2=cx+ir*Math.cos(startAngle+angle),iy2=cy+ir*Math.sin(startAngle+angle);
        var large=angle>Math.PI?1:0;
        var col=COLORES[e[0]]||"#888";
        paths+='<path d="M '+ix1+' '+iy1+' L '+x1+' '+y1+' A '+r+' '+r+' 0 '+large+' 1 '+x2+' '+y2+' L '+ix2+' '+iy2+' A '+ir+' '+ir+' 0 '+large+' 0 '+ix1+' '+iy1+' Z" fill="'+col+'"/>';
        startAngle+=angle;
      });
      return '<svg width="300" height="300" viewBox="0 0 300 300">'+paths+'</svg>';
    }

    // --- bar chart SVG (ultimos 6 meses hasta fMes/fAnio en moneda seleccionada) ---
    function buildBars(){
      var months=[];
      for(var i=5;i>=0;i--){
        var d=new Date(fAnio,fMes-1-i,1);
        months.push({mes:d.getMonth()+1,anio:d.getFullYear(),k:mk(d.getMonth()+1,d.getFullYear()),label:MESES[d.getMonth()]+"'"+String(d.getFullYear()).slice(2)});
      }
      var data=months.map(function(m){
        var gg=gastos.filter(function(g){return g.mes===m.mes&&g.anio===m.anio&&g.monto>0;});
        function conv(v){
          if(mon==="USD"){var t=tc[m.k];return t?Math.round(v/t):0;}
          if(mon==="CER"){var cm=cer[m.k];return cm&&cerU?Math.round(v*cerU/cm):0;}
          return Math.round(v);
        }
        var ma=0,al=0,mu=0;
        gg.forEach(function(g){var v=conv(g.monto);if(g.nombre==="Marcos")ma+=v;else if(g.nombre==="Aldana")al+=v;else if(g.nombre==="Muni")mu+=v;});
        return{label:m.label,Marcos:ma,Aldana:al,Muni:mu,total:ma+al+mu};
      });
      var maxV=Math.max.apply(null,data.map(function(d){return d.total;}));
      if(maxV===0) return "<p style='color:#999;font-size:13px'>Sin datos</p>";
      var W=640,H=200,pad=10,barW=70,gap=16,topPad=36;
      var bars="",labels="",totals="",separators="";
      data.forEach(function(d,i){
        var x=pad+i*(barW+gap);
        var hMa=maxV>0?d.Marcos/maxV*(H-topPad):0;
        var hAl=maxV>0?d.Aldana/maxV*(H-topPad):0;
        var hMu=maxV>0?d.Muni/maxV*(H-topPad):0;
        var yBase=H;
        // separator line before each bar (except first)
        if(i>0) separators+='<line x1="'+x+'" y1="0" x2="'+x+'" y2="'+H+'" stroke="#F0EDE8" stroke-width="1"/>';
        bars+='<rect x="'+x+'" y="'+(yBase-hMa)+'" width="'+barW+'" height="'+hMa+'" fill="#2d3561" rx="2"/>';
        bars+='<rect x="'+x+'" y="'+(yBase-hMa-hAl)+'" width="'+barW+'" height="'+hAl+'" fill="#3d4e8a" rx="2"/>';
        bars+='<rect x="'+x+'" y="'+(yBase-hMa-hAl-hMu)+'" width="'+barW+'" height="'+hMu+'" fill="#C49A6C" rx="2"/>';
        labels+='<text x="'+(x+barW/2)+'" y="'+(H+16)+'" text-anchor="middle" font-size="11" fill="#9CA3AF">'+d.label+'</text>';
        if(d.total>0){
          // format with 2 decimals for k/M
          var totalLabel;
          if(d.total>=1000000) totalLabel="$"+(d.total/1000000).toFixed(2)+"M";
          else if(d.total>=1000) totalLabel="$"+(d.total/1000).toFixed(2)+"k";
          else totalLabel="$"+d.total;
          var yTop=yBase-hMa-hAl-hMu-8;
          totals+='<text x="'+(x+barW/2)+'" y="'+yTop+'" text-anchor="middle" font-size="11" font-weight="600" fill="#1a1f3a">'+totalLabel+'</text>';
          // variation vs previous month
          if(i>0&&data[i-1].total>0){
            var vari=((d.total-data[i-1].total)/data[i-1].total)*100;
            var arrow=vari>=0?"↑":"↓";
            var variColor=vari>=0?"#E8303A":"#1D9E75";
            var variLabel=arrow+Math.abs(vari).toFixed(1)+"%";
            totals+='<text x="'+(x+barW/2)+'" y="'+(yTop-13)+'" text-anchor="middle" font-size="10" fill="'+variColor+'">'+variLabel+'</text>';
          }
        }
      });
      // centered legend
      var legendY=H+32;
      var legendW=pad+(0*(barW+gap))+(barW/2);// center calc
      var totalLegendW=14+55+14+55+14+40; // approx width
      var lx=(W-totalLegendW)/2;
      var legend='<g>';
      legend+='<rect x="'+lx+'" y="'+legendY+'" width="10" height="10" fill="#2d3561" rx="2"/><text x="'+(lx+14)+'" y="'+(legendY+9)+'" font-size="11" fill="#6B7280">Marcos</text>';
      legend+='<rect x="'+(lx+70)+'" y="'+legendY+'" width="10" height="10" fill="#3d4e8a" rx="2"/><text x="'+(lx+84)+'" y="'+(legendY+9)+'" font-size="11" fill="#6B7280">Aldana</text>';
      legend+='<rect x="'+(lx+144)+'" y="'+legendY+'" width="10" height="10" fill="#C49A6C" rx="2"/><text x="'+(lx+158)+'" y="'+(legendY+9)+'" font-size="11" fill="#6B7280">Muni</text>';
      legend+='</g>';
      return '<div style="text-align:center"><svg width="'+W+'" height="'+(H+50)+'" viewBox="0 0 '+W+' '+(H+50)+'">'+separators+bars+labels+totals+legend+'</svg></div>';
    }

    // --- tabla categorias ---
    var catRows=cats.map(function(e){
      var cat=e[0],tot=e[1],pct=totM>0?Math.round(Math.abs(tot)/Math.abs(totM)*100):0;
      var vari=vPct(cat);
      var vc=vari===null?"#9CA3AF":vari>0?"#E8303A":"#1D9E75";
      var vt=vari===null?"—":(vari>0?"+":"")+vari.toFixed(1)+"%";
      return '<tr><td style="padding:8px 10px;border-bottom:1px solid #F0EDE8;font-size:13px"><span style="display:inline-flex;align-items:center;gap:6px"><span style="width:9px;height:9px;border-radius:2px;background:'+( COLORES[cat]||"#888")+';display:inline-block"></span>'+cat+'</span></td><td style="padding:8px 10px;border-bottom:1px solid #F0EDE8;text-align:right;font-size:13px;font-weight:600">'+fmtCur(tot)+'</td><td style="padding:8px 10px;border-bottom:1px solid #F0EDE8;text-align:right;font-size:12px">'+pct+'%</td><td style="padding:8px 10px;border-bottom:1px solid #F0EDE8;text-align:right;font-size:12px;color:'+vc+';font-weight:600">'+vt+'</td></tr>';
    }).join("");

    var html='<!DOCTYPE html><html><head><meta charset="utf-8"><title>Gastos AM - '+mesLabel+'</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#F5F3EF;color:#1a1a2e;padding:32px}@media print{body{background:#fff;padding:16px}.no-print{display:none}}.page{max-width:720px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)}.hdr{background:linear-gradient(135deg,#1a1f3a 0%,#2d3561 60%,#3d4e8a 100%);padding:28px 32px;color:#fff}.hdr h1{font-size:24px;font-weight:700;margin-bottom:4px}.hdr p{font-size:13px;color:rgba(255,255,255,0.6)}.body{padding:28px 32px}.sec{font-size:11px;font-weight:600;color:#9CA3AF;letter-spacing:0.06em;text-transform:uppercase;margin:0 0 12px}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:28px}.card{background:#F5F3EF;border-radius:10px;padding:14px 16px}.card.dark{background:#1a1f3a}.card .l{font-size:10px;color:#9CA3AF;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:4px}.card.dark .l{color:rgba(255,255,255,0.5)}.card .v{font-size:17px;font-weight:700;color:#1a1f3a}.card.dark .v{color:#fff}.card .s{font-size:10px;color:#B8B4AD;margin-top:2px}.card.dark .s{color:rgba(255,255,255,0.4)}.section{margin-bottom:28px}table{width:100%;border-collapse:collapse}th{font-size:11px;color:#9CA3AF;font-weight:600;padding:8px 10px;text-align:left;border-bottom:1.5px solid #E8E4DD;letter-spacing:0.04em;text-transform:uppercase}th.r{text-align:right}.charts{display:grid;grid-template-columns:300px 1fr;gap:24px;align-items:start;margin-bottom:28px}.print-btn{display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:#1a1f3a;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:20px;font-family:inherit}</style></head><body>';
    html+='<div class="no-print" style="max-width:720px;margin:0 auto 16px"><button class="print-btn" onclick="window.print()">Imprimir / Guardar PDF</button></div>';
    html+='<div class="page">';
    html+='<div class="hdr"><h1>Gastos AM &mdash; '+mesLabel+'</h1><p>Informe mensual &middot; '+monLabel+'</p></div>';
    html+='<div class="body">';
    html+='<div class="section"><p class="sec">Resumen</p><div class="cards">';
    html+='<div class="card dark"><p class="l">Total</p><p class="v">'+fmtCur(totM)+'</p><p class="s">todos los gastos</p></div>';
    html+='<div class="card"><p class="l">Marcos</p><p class="v">'+fmtCur(totMa)+'</p></div>';
    html+='<div class="card"><p class="l">Aldana</p><p class="v">'+fmtCur(totAl)+'</p></div>';
    html+='<div class="card"><p class="l">Saldo</p><p class="v">'+fmtCur(Math.abs(saldoR))+'</p><p class="s">'+(saldoR===0?"Al dia":saldoR>0?"A favor Marcos":"A favor Aldana")+'</p></div>';
    html+='</div></div>';
    html+='<div class="section charts"><div><p class="sec">Distribucion por categoria</p>'+buildPie(cats,totM)+'</div>';
    html+='<div style="padding-top:28px"><table><thead><tr><th>Categoria</th><th class="r">Monto</th><th class="r">%</th><th class="r">vs mes ant.</th></tr></thead><tbody>'+catRows+'</tbody></table></div></div>';
    html+='<div class="section"><p class="sec">Evolucion por persona &mdash; ultimos 6 meses ('+monLabel+')</p>'+buildBars()+'</div>';
    html+='</div></div></body></html>';

    setReporteHtml(html);
  }
  function procesarPDF(file){
    if(!file)return;
    setPdfL(true);setPdfE("");setPdfR(null);
    var reader=new FileReader();
    reader.onload=function(e){
      var b64=e.target.result.split(",")[1];
      var instr=pdfF==="Banco"?"Extrae SOLO debitos, consumos debito, transferencias salientes y pagos. Ignora acreditaciones y depositos.\n\n":pdfF==="MercadoPago"?"Extrae SOLO pagos y transferencias enviadas. Ignora ingresos y reintegros.\n\n":"Extrae todos los consumos. Ignora pagos del resumen y ajustes a favor.\n\n";
      var prompt="Extrae transacciones de este resumen financiero argentino.\n\n"+instr+"Fuente: "+pdfF+"\nTitular: "+pdfP+"\nCategorias: "+CATEGORIAS.join(", ")+"\nMedios: "+MEDIOS.join(", ")+"\n\nPara cada transaccion: mes(1-12), anio, descripcion, monto(ARS positivo), cuota('2/12' o ''), etiqueta, medio. NO incluyas nombre.\nResponde SOLO con JSON array valido sin markdown.";
      fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:4000,messages:[{role:"user",content:[{type:"document",source:{type:"base64",media_type:"application/pdf",data:b64}},{type:"text",text:prompt}]}]})})
      .then(function(r){return r.json();})
      .then(function(d){
        var txt=(d.content||[]).map(function(b){return b.text||"";}).join("").replace(/```json|```/g,"").trim();
        var parsed=JSON.parse(txt);
        if(!Array.isArray(parsed))throw new Error("Respuesta inesperada");
        setPdfR(parsed.map(function(r,i){return Object.assign({},r,{_id:i,_sel:true,nombre:pdfP,mes:pdfMes,anio:pdfAnio});}));
        setPdfL(false);
      }).catch(function(err){setPdfE("Error: "+err.message);setPdfL(false);});
    };
    reader.readAsDataURL(file);
  }
  function confirmarPDF(){
    var sel=(pdfR||[]).filter(function(r){return r._sel;});
    if(!sel.length){notify("No hay filas seleccionadas.");return;}
    saveG(gastos.concat(sel.map(function(r,i){return{id:Date.now()+i,mes:r.mes,anio:r.anio,descripcion:r.descripcion,cuota:r.cuota||"",monto:parseFloat(r.monto)||0,etiqueta:r.etiqueta,nombre:r.nombre,medio:r.medio};})));
    setPdfR(null);notify("Se importaron "+sel.length+" gastos.");
  }
  function setPR(id,key,val){setPdfR(function(p){return p.map(function(x){return x._id===id?Object.assign({},x,{[key]:val}):x;});});}

  var catM=CATEGORIAS.filter(function(c){return c.toLowerCase().indexOf((form._ci||"").toLowerCase())>=0;});

  // Pie chart data
  var PIE_UMBRAL=0.05;
  var catsPos=cats.filter(function(e){return e[1]>0;});
  var principales=catsPos.filter(function(e){return Math.abs(e[1])/Math.abs(totM)>=PIE_UMBRAL;});
  var catOtros=catsPos.filter(function(e){return Math.abs(e[1])/Math.abs(totM)<PIE_UMBRAL;});
  var otrosTotal=catOtros.reduce(function(s,e){return s+e[1];},0);
  var pieData=principales.map(function(e){return{name:cl(e[0]),value:Math.abs(e[1]),cat:e[0]};});
  if(otrosTotal>0) pieData.push({name:"Otros",value:Math.abs(otrosTotal),cat:"Otros"});
  var pieTotalAbs=Math.abs(totM);
  var pieTotalLabel=(function(){
    if(mon==="USD"){if(!tcV)return"—";var v=pieTotalAbs/tcV;return v>=1000?"U$S "+(v/1000).toFixed(1)+"k":"U$S "+Math.round(v);}
    var vv=mon==="CER"?(fcer(fMes,fAnio)?pieTotalAbs*fcer(fMes,fAnio):pieTotalAbs):pieTotalAbs;
    return vv>=1000000?"$"+(vv/1000000).toFixed(2)+"M":vv>=1000?"$"+(vv/1000).toFixed(1)+"k":"$"+Math.round(vv);
  })();
  var PIE_RADIAN=Math.PI/180;
  function renderPieLabel(props){
    var cx=props.cx,cy=props.cy,midAngle=props.midAngle,innerRadius=props.innerRadius,outerRadius=props.outerRadius,percent=props.percent;
    if(percent<PIE_UMBRAL) return null;
    var radius=innerRadius+(outerRadius-innerRadius)*0.5;
    var x=cx+radius*Math.cos(-midAngle*PIE_RADIAN);
    var y=cy+radius*Math.sin(-midAngle*PIE_RADIAN);
    return <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>{Math.round(percent*100)+"%"}</text>;
  }

  var btnSt=function(act){return{fontSize:12,padding:"5px 12px",borderRadius:999,cursor:"pointer",border:act?"1px solid #1a1f3a":"1px solid #E2DDD6",background:act?"#1a1f3a":"transparent",color:act?"#fff":"#6B7280",fontWeight:act?600:400,fontFamily:"inherit"};};

  function handleLogin(){
    setAuthError("");
    signInWithPopup(auth,provider).then(function(result){
      if(!ALLOWED_EMAILS.includes(result.user.email)){signOut(auth);setAuthError("Esta cuenta no tiene acceso.");}
    }).catch(function(){setAuthError("Error al iniciar sesion. Intentá de nuevo.");});
  }

  if(authLoading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:"#F5F3EF",fontFamily:"system-ui"}}><p style={{color:"#9CA3AF"}}>Cargando...</p></div>;

  if(!user||!ALLOWED_EMAILS.includes(user.email)) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:"#F5F3EF",fontFamily:"system-ui"}}>
      <div style={{background:"#fff",borderRadius:20,padding:"48px 40px",boxShadow:"0 8px 40px rgba(0,0,0,0.10)",textAlign:"center",maxWidth:380,width:"100%"}}>
        <div style={{background:"linear-gradient(135deg,#1a1f3a 0%,#3d4e8a 100%)",borderRadius:14,width:60,height:60,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",fontSize:28}}>💰</div>
        <h1 style={{fontSize:22,fontWeight:700,color:"#1a1f3a",margin:"0 0 6px"}}>Gastos <span style={{color:"#C49A6C"}}>AM</span></h1>
        <p style={{fontSize:13,color:"#9CA3AF",margin:"0 0 32px"}}>Organizador de gastos del hogar</p>
        <button onClick={handleLogin} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,width:"100%",padding:"12px 20px",background:"#fff",border:"1.5px solid #E2DDD6",borderRadius:10,fontSize:14,fontWeight:600,color:"#1a1f3a",cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Ingresar con Google
        </button>
        {authError && <p style={{fontSize:12,color:"#E8303A",marginTop:12}}>{authError}</p>}
      </div>
    </div>
  );

  return (
    <div className="gr">
      <style>{CSS}</style>

      <div className="hdr">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",position:"relative",zIndex:1}}>
          <div>
            <h1 className="title">Gastos <span className="accent">AM</span></h1>
            <p className="sub">Organizador de gastos del hogar</p>
            <div style={{marginTop:10,display:"flex",gap:6,flexWrap:"wrap"}}>
              {gastos.length>0 && <span className="badge">{gastos.length} registros</span>}
              {totM>0 && <span className="badge">{fmt(totM)} este mes</span>}
              <span className="badge">{user.displayName||user.email}</span>
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8,alignItems:"flex-end"}}>
            <button onClick={function(){signOut(auth);}} style={{fontSize:11,padding:"4px 10px",borderRadius:999,border:"1px solid rgba(255,255,255,0.3)",background:"transparent",color:"rgba(255,255,255,0.7)",cursor:"pointer",fontFamily:"inherit"}}>Salir</button>
          <div className="mw">
            <p style={{fontSize:10,color:"rgba(255,255,255,0.45)",margin:"0 0 8px",fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase"}}>Moneda</p>
            <div style={{display:"flex",gap:4,marginBottom:8,flexWrap:"wrap"}}>
              {["ARS","CER","USD"].map(function(m){return <button key={m} onClick={function(){setMon(m);setTCM("");setCerM("");}} className={"mp"+(mon===m?" on":"")}>{m==="CER"?"CER":m}</button>;}) }
            </div>
            {mon==="USD"&&tcX ? (
              <div>
                <p style={{fontSize:10,color:"#FBBF24",margin:"0 0 4px"}}>Sin TC</p>
                <input type="number" placeholder="TC MEP" value={tcM} onChange={function(e){setTCM(e.target.value);}} onBlur={storeTC} style={{width:"100%",fontSize:12,padding:"4px 8px",border:"1px solid #FBBF24",borderRadius:6,background:"rgba(255,255,255,0.1)",color:"#fff",fontFamily:"inherit"}}/>
              </div>
            ) : mon==="CER"&&cerX ? (
              <div>
                <p style={{fontSize:10,color:"#FBBF24",margin:"0 0 4px"}}>{!cerU?"CER base":"Sin CER"}</p>
                <input type="number" placeholder="Valor CER" value={cerM} onChange={function(e){setCerM(e.target.value);}} onBlur={storeCer} style={{width:"100%",fontSize:12,padding:"4px 8px",border:"1px solid #FBBF24",borderRadius:6,background:"rgba(255,255,255,0.1)",color:"#fff",fontFamily:"inherit"}}/>
              </div>
            ) : (
              <p style={{fontSize:10,color:"rgba(255,255,255,0.4)",margin:0}}>{cSub}</p>
            )}
          </div>
          </div>
        </div>
      </div>

      <div className="tabs">
        {["resumen","detalle","historico","graficos","analisis","importar","exportar"].map(function(v){
          var L={resumen:"Resumen",detalle:"Detalle",historico:"Historial",graficos:"Graficos",analisis:"Analisis",importar:"Importar",exportar:"Exportar"}[v];
          return <button key={v} onClick={function(){
            setV(v);
            if(v==="graficos") setGrafMounted(true);
            if(v==="analisis") setAnMounted(true);
          }} className={"tab"+(vista===v?" on":"")}>{L}</button>;
        })}
      </div>

      <div className="body">
        {msg && <div className="ntf">{msg}</div>}

        {vista!=="importar"&&vista!=="exportar"&&vista!=="analisis" && (
          <div className="nav">
            <button onClick={prev} className="navbtn">&#8249;</button>
            <select value={fMes} onChange={function(e){setFM(+e.target.value);}} style={{fontSize:14,fontWeight:700,padding:"5px 8px",border:"none",background:"transparent",color:"#1a1f3a",cursor:"pointer",fontFamily:"inherit"}}>
              {MESES.map(function(l,i){return <option key={i+1} value={i+1}>{l}</option>;})}
            </select>
            <select value={fAnio} onChange={function(e){setFA(+e.target.value);}} style={{fontSize:14,fontWeight:700,padding:"5px 8px",border:"none",background:"transparent",color:"#1a1f3a",cursor:"pointer",fontFamily:"inherit"}}>
              {years.map(function(a){return <option key={a} value={a}>{a}</option>;})}
            </select>
            <button onClick={next} className="navbtn">&#8250;</button>
            <div style={{width:1,height:22,background:"#E2DDD6",margin:"0 4px"}}/>
            {["Todos","Marcos","Aldana"].map(function(p){return <button key={p} onClick={function(){setFP(p);}} className={"pill"+(fP===p?" on":"")}>{p}</button>;})}
          </div>
        )}

        {vista==="resumen" && (
          <div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:20}}>
              {cards.map(function(c){
                return c.dark ? (
                  <div key={c.l} className="cd">
                    <p className="l">{c.l}</p><p className="v">{c.v}</p><p className="s">{c.s}</p>
                  </div>
                ) : (
                  <div key={c.l} className="cw">
                    <p className="l">{c.l}</p><p className="v">{c.v}</p><p className="s">{c.s}</p>
                  </div>
                );
              })}
            </div>
            <p className="sec">Por categoria — {MESES[fMes-1]} {fAnio}</p>
            {cats.length===0 ? (
              <p style={{fontSize:13,color:"#9CA3AF",background:"#fff",borderRadius:12,padding:"20px",textAlign:"center"}}>Sin gastos este mes.</p>
            ) : (
              <div className="cw" style={{marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,fontWeight:600,color:"#B8B4AD",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:10,paddingBottom:8,borderBottom:"1px solid #F0EDE8"}}>
                  <span>Categoria</span>
                  <span style={{display:"flex",gap:32}}>
                    <span style={{minWidth:60,textAlign:"right"}}>Monto</span>
                    <span style={{minWidth:56,textAlign:"right"}}>vs {MESES[pM2-1]}</span>
                  </span>
                </div>
                {cats.map(function(e){
                  var cat=e[0],tot=e[1],pct=totM>0?Math.abs(tot)/Math.abs(totM):0;
                  var vari=vPct(cat),vc=vari===null?"#B8B4AD":vari>0?"#E8303A":"#1D9E75",vt=vari===null?"—":(vari>0?"+":"")+vari.toFixed(1)+"%";
                  return (
                    <div key={cat} style={{marginBottom:12}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13,marginBottom:5}}>
                        <span style={{display:"flex",alignItems:"center",gap:8,fontWeight:500}}>
                          <span style={{width:10,height:10,borderRadius:3,display:"inline-block",background:COLORES[cat]||"#888",flexShrink:0}}/>
                          {cl(cat)}
                        </span>
                        <span style={{display:"flex",gap:32,alignItems:"center"}}>
                          <span style={{minWidth:60,textAlign:"right",color:"#6B7280",fontWeight:500}}>{fmt(tot)}</span>
                          <span style={{minWidth:56,textAlign:"right",fontSize:12,fontWeight:600,color:vc}}>{vt}</span>
                        </span>
                      </div>
                      <div style={{height:5,background:"#F0EDE8",borderRadius:99}}>
                        <div style={{height:"100%",borderRadius:99,width:(pct*100)+"%",background:COLORES[cat]||"#888"}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <button onClick={function(){setShowF(true);}} className="addbtn">
              <span className="plus">+</span>Agregar gasto
            </button>
            <button onClick={generarReporte} style={{display:"inline-flex",alignItems:"center",gap:8,padding:"10px 20px",background:"transparent",color:"#1a1f3a",border:"1.5px solid #1a1f3a",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginTop:16,marginLeft:10}}>
              Exportar PDF
            </button>
          </div>
        )}

        {vista==="detalle" && (
          <div>
            <div style={{position:"relative",marginBottom:12}}>
              <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:13,color:"#B8B4AD",pointerEvents:"none"}}>&#128269;</span>
              <input value={bus} onChange={function(e){setBus(e.target.value);}} placeholder="Buscar en todos los gastos..." style={{width:"100%",boxSizing:"border-box",fontSize:13,padding:"10px 36px",border:"1.5px solid "+(bus?"#3D4E8A":"#E2DDD6"),borderRadius:10,background:"#fff",color:"#1a1a2e",fontFamily:"inherit",outline:"none"}}/>
              {bus && <button onClick={function(){setBus("");}} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:16,border:"none",background:"transparent",color:"#B8B4AD",cursor:"pointer",lineHeight:1}}>x</button>}
            </div>
            {bus ? (
              <p style={{fontSize:12,color:"#9CA3AF",marginBottom:10}}>{gF.length} resultado{gF.length!==1?"s":""} para "{bus}"</p>
            ) : (
              <p style={{fontSize:12,color:"#9CA3AF",marginBottom:10}}>{MESES[fMes-1]} {fAnio} - {gS.length} gastos</p>
            )}
            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:10}}>
              {["Todas"].concat(CATEGORIAS).map(function(c){
                var act=fC===c;
                return (
                  <button key={c} onClick={function(){setFC(c);}} style={{fontSize:11,padding:"4px 10px",borderRadius:999,cursor:"pointer",border:act?"1px solid #1a1f3a":"1px solid #E2DDD6",background:act?"#1a1f3a":"transparent",color:act?"#fff":"#6B7280",fontWeight:act?600:400,display:"inline-flex",alignItems:"center",gap:4,fontFamily:"inherit"}}>
                    {c!=="Todas" && <span style={{width:7,height:7,borderRadius:2,display:"inline-block",background:COLORES[c]||"#888"}}/>}
                    {cl(c)}
                  </button>
                );
              })}
            </div>
            {gS.length===0 ? (
              <p style={{fontSize:13,color:"#9CA3AF"}}>Sin gastos para este filtro.</p>
            ) : (
              <div className="cw" style={{padding:0,overflow:"hidden"}}>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead>
                      <tr style={{background:"#FAFAF9"}}>
                        {["descripcion","etiqueta","nombre","monto","medio"].map(function(col){
                          var L={descripcion:"Descripcion",etiqueta:"Categoria",nombre:"Quien",monto:"Monto",medio:"Medio"}[col];
                          return <th key={col} style={thS} onClick={function(){setSD(sc===col?-sd:1);setSC(col);}}>{L}{sc===col?(sd===1?" ^":" v"):""}</th>;
                        })}
                        {bus && <th style={thS}>Periodo</th>}
                        <th style={thS}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {gS.map(function(g){
                        var q=bus.trim(),idx=q?g.descripcion.toLowerCase().indexOf(q.toLowerCase()):-1;
                        return (
                          <tr key={g.id}>
                            <td style={tdS}>
                              {idx>=0 ? (
                                <span>
                                  {g.descripcion.slice(0,idx)}
                                  <mark style={{background:"#FEF3C7",borderRadius:2,padding:"0 1px"}}>{g.descripcion.slice(idx,idx+q.length)}</mark>
                                  {g.descripcion.slice(idx+q.length)}
                                  {g.cuota && <span style={{fontSize:11,color:"#9CA3AF",marginLeft:6}}>{g.cuota}</span>}
                                </span>
                              ) : (
                                <span>{g.descripcion}{g.cuota && <span style={{fontSize:11,color:"#9CA3AF",marginLeft:6}}>{g.cuota}</span>}</span>
                              )}
                            </td>
                            <td style={tdS}><span style={{display:"inline-flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:2,background:COLORES[g.etiqueta]||"#888",flexShrink:0}}/>{cl(g.etiqueta)}</span></td>
                            <td style={tdS}>{g.nombre}</td>
                            <td style={Object.assign({},tdS,{fontWeight:600,textAlign:"right"})}>{fmt(g.monto)}</td>
                            <td style={Object.assign({},tdS,{color:"#9CA3AF"})}>{cl(g.medio)}</td>
                            {bus && <td style={Object.assign({},tdS,{color:"#9CA3AF",whiteSpace:"nowrap"})}>{MESES[g.mes-1]} {g.anio}</td>}
                            <td style={tdS}>
                              <div style={{display:"flex",gap:4}}>
                                <button onClick={function(){editG(g);}} style={{fontSize:11,padding:"2px 8px",border:"1px solid #E2DDD6",borderRadius:6,background:"transparent",color:"#6B7280",cursor:"pointer"}}>&#9998;</button>
                                <button onClick={function(){delG(g.id);}} style={{fontSize:11,padding:"2px 8px",border:"1px solid #E2DDD6",borderRadius:6,background:"transparent",color:"#E8303A",cursor:"pointer"}}>x</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {vista==="historico" && (
          <div>
            <p style={{fontSize:13,color:"#9CA3AF",marginBottom:14}}>{gastos.length} registros totales</p>
            {mD.length===0 ? (
              <p style={{fontSize:13,color:"#9CA3AF"}}>Sin datos aun.</p>
            ) : (
              mD.slice().reverse().map(function(k){
                var pts=k.split("-"),a=parseInt(pts[0]),m=parseInt(pts[1]);
                var gg=gastos.filter(function(g){return g.mes===m&&g.anio===a;});
                var tot=gg.reduce(function(s,g){return s+g.monto;},0);
                var ma=gg.filter(function(g){return g.nombre==="Marcos";}).reduce(function(s,g){return s+g.monto;},0);
                var al=gg.filter(function(g){return g.nombre==="Aldana";}).reduce(function(s,g){return s+g.monto;},0);
                var mu=gg.filter(function(g){return g.nombre==="Muni";}).reduce(function(s,g){return s+g.monto;},0);
                return (
                  <div key={k} onClick={function(){setFM(m);setFA(a);setV("detalle");}} className={"hrow"+(m===fMes&&a===fAnio?" on":"")}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:14,fontWeight:600,color:"#1a1f3a"}}>{MESES[m-1]} {a}</span>
                      <span style={{fontSize:15,fontWeight:700,color:"#1a1f3a"}}>{fmtK(tot,m,a)}</span>
                    </div>
                    <div style={{display:"flex",gap:14,marginTop:5,fontSize:12,color:"#9CA3AF"}}>
                      <span>Marcos: <strong style={{color:"#6B7280"}}>{fmtK(ma,m,a)}</strong></span>
                      <span>Aldana: <strong style={{color:"#6B7280"}}>{fmtK(al,m,a)}</strong></span>
                      {mu!==0 && <span>Muni: <strong style={{color:"#6B7280"}}>{fmtK(mu,m,a)}</strong></span>}
                      <span>{gg.length} gastos</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {vista==="graficos" && grafMounted && (
          <div>
            <div style={{display:"flex",gap:5,marginBottom:20,flexWrap:"wrap"}}>
              {["ARS","CER","USD"].map(function(m){return <button key={m} onClick={function(){setMon(m);}} style={btnSt(mon===m)}>{m==="CER"?"ARS const.":m}</button>;}) }
            </div>
            <p className="sec" style={{marginBottom:10}}>Distribucion — {MESES[fMes-1]} {fAnio}</p>
            {cats.length===0 ? (
              <p style={{fontSize:13,color:"#9CA3AF"}}>Sin gastos este mes.</p>
            ) : (
              <div className="cw" style={{marginBottom:28,padding:"16px 0 16px"}}>
                <div style={{position:"relative",width:"100%",height:300}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius="38%" outerRadius="64%" paddingAngle={2} dataKey="value" labelLine={false} label={renderPieLabel}>
                        {pieData.map(function(e){return <Cell key={e.cat} fill={e.cat==="Otros"?"#C8C4BE":(COLORES[e.cat]||"#888")} stroke="none"/>;}) }
                      </Pie>
                      <Tooltip formatter={function(value,name){var pct=totM>0?Math.round(value/Math.abs(totM)*100):0;var raw=catsPos.find(function(e){return cl(e[0])===name;});return[fmt(raw?raw[1]:value)+" · "+pct+"%",name];}} contentStyle={{fontSize:12,borderRadius:8,border:"1px solid #E2DDD6",background:"#fff",color:"#1a1a2e"}}/>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",textAlign:"center",pointerEvents:"none"}}>
                    <p style={{fontSize:10,color:"#9CA3AF",margin:"0 0 2px",fontWeight:600,letterSpacing:"0.05em",textTransform:"uppercase"}}>Total</p>
                    <p style={{fontSize:16,fontWeight:700,color:"#1a1f3a",margin:0,lineHeight:1}}>{pieTotalLabel}</p>
                  </div>
                </div>
                {principales.length>0 && (
                  <div style={{display:"flex",flexWrap:"wrap",justifyContent:"center",gap:"6px 16px",padding:"0 16px",marginTop:8}}>
                    {principales.slice().sort(function(a,b){return b[1]-a[1];}).map(function(e){
                      return (
                        <span key={e[0]} style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,color:"#6B7280"}}>
                          <span style={{width:9,height:9,borderRadius:2,flexShrink:0,background:COLORES[e[0]]||"#888",display:"inline-block"}}/>
                          {cl(e[0])}
                        </span>
                      );
                    })}
                    {otrosTotal>0 && (
                      <span style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,color:"#6B7280"}}>
                        <span style={{width:9,height:9,borderRadius:2,flexShrink:0,background:"#C8C4BE",display:"inline-block"}}/>
                        Otros
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
              <p className="sec" style={{margin:0}}>Evolucion mensual por persona</p>
              <div style={{display:"flex",gap:5}}>
                {[6,12,24,36].map(function(r){return <button key={r} onClick={function(){setRango(r);}} style={btnSt(rango===r)}>{r}m</button>;}) }
              </div>
            </div>
            {rK.length===0 ? (
              <p style={{fontSize:13,color:"#9CA3AF"}}>Sin datos historicos aun.</p>
            ) : (
              <div className="cw" style={{padding:"16px 8px 8px",height:320}}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barD} margin={{top:4,right:8,left:4,bottom:28}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE8" vertical={false}/>
                    <XAxis dataKey="mes" tick={{fontSize:10,fill:"#9CA3AF"}} angle={-45} textAnchor="end" interval={0}/>
                    <YAxis tick={{fontSize:10,fill:"#9CA3AF"}} tickFormatter={function(v){return v>=1000000?"$"+(v/1000000).toFixed(1)+"M":v>=1000?"$"+(v/1000).toFixed(0)+"k":"$"+v;}} width={52}/>
                    <Tooltip formatter={function(value,name){return["$"+Math.round(value).toLocaleString("es-AR"),name];}} contentStyle={{fontSize:12,borderRadius:8,border:"1px solid #E2DDD6",background:"#fff",color:"#1a1a2e"}}/>
                    <Legend iconType="square" iconSize={9} formatter={function(value){return <span style={{fontSize:11,color:"#6B7280"}}>{value}</span>;}}/>
                    <Bar dataKey="Marcos" stackId="a" fill="#2d3561" stroke="none"/>
                    <Bar dataKey="Aldana" stackId="a" fill="#3d4e8a" stroke="none"/>
                    <Bar dataKey="Muni" stackId="a" fill="#C49A6C" stroke="none"/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {vista==="analisis" && anMounted && AnalisSection(gastos,anCat,setAnCat,anMes,setAnMes,anRango,setAnRango,anMA,setAnMA,fmt,fmtK,convVal,cl,CATEGORIAS,COLORES,MESES,mk,thS,tdS,btnSt,Cell)}

        {vista==="importar" && (
          <div style={{marginTop:8}}>
            <p style={{fontSize:15,fontWeight:700,color:"#1a1f3a",margin:"0 0 4px"}}>Importar desde PDF con IA</p>
            <p style={{fontSize:13,color:"#9CA3AF",marginBottom:14}}>Subi un resumen de tarjeta, extracto bancario o billetera.</p>
            {!pdfR&&!pdfL && (
              <div className="cw" style={{marginBottom:20}}>
                <div style={{marginBottom:12}}>
                  <p style={{fontSize:11,color:"#9CA3AF",margin:"0 0 7px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>Fuente</p>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    {["Tarjeta de credito","MercadoPago","Banco"].map(function(f){return <button key={f} onClick={function(){setPdfF(f);}} style={btnSt(pdfF===f)}>{f}</button>;}) }
                  </div>
                </div>
                <div style={{marginBottom:12}}>
                  <p style={{fontSize:11,color:"#9CA3AF",margin:"0 0 7px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>De quien?</p>
                  <div style={{display:"flex",gap:5}}>
                    {["Marcos","Aldana"].map(function(p){return <button key={p} onClick={function(){setPdfP(p);}} style={btnSt(pdfP===p)}>{p}</button>;}) }
                  </div>
                </div>
                <div style={{marginBottom:16}}>
                  <p style={{fontSize:11,color:"#9CA3AF",margin:"0 0 7px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>Periodo a asignar</p>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <select value={pdfMes} onChange={function(e){setPdfMes(+e.target.value);}} style={{fontSize:13,padding:"5px 8px",border:"1.5px solid #E2DDD6",borderRadius:8,background:"#fff",color:"#1a1f3a",fontFamily:"inherit",cursor:"pointer"}}>
                      {MESES.map(function(l,i){return <option key={i+1} value={i+1}>{l}</option>;})}
                    </select>
                    <input type="number" value={pdfAnio} onChange={function(e){setPdfAnio(+e.target.value);}} style={{width:72,fontSize:13,padding:"5px 8px",border:"1.5px solid #E2DDD6",borderRadius:8,background:"#fff",color:"#1a1f3a",fontFamily:"inherit"}}/>
                  </div>
                </div>
                <label style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,padding:"24px",border:"2px dashed #E2DDD6",borderRadius:10,cursor:"pointer",background:"#F5F3EF"}}>
                  <span style={{fontSize:28}}>&#128196;</span>
                  <span style={{fontSize:13,fontWeight:600,color:"#1a1f3a"}}>Seleccionar PDF</span>
                  <span style={{fontSize:12,color:"#9CA3AF"}}>Click o arrastra el archivo aqui</span>
                  <input type="file" accept=".pdf" style={{display:"none"}} onChange={function(e){if(e.target.files[0])procesarPDF(e.target.files[0]);}}/>
                </label>
                {pdfE && <p style={{fontSize:12,color:"#E8303A",marginTop:10}}>{pdfE}</p>}
              </div>
            )}
            {pdfL && (
              <div className="cw" style={{textAlign:"center",padding:"32px",marginBottom:20}}>
                <p style={{fontSize:13,fontWeight:600,color:"#1a1f3a",margin:"0 0 4px"}}>Procesando el PDF...</p>
                <p style={{fontSize:12,color:"#9CA3AF",margin:0}}>Claude esta leyendo y clasificando las transacciones.</p>
              </div>
            )}
            {pdfR && (
              <div style={{marginBottom:20}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
                  <div>
                    <p style={{fontSize:13,fontWeight:600,color:"#1a1f3a",margin:"0 0 2px"}}>{pdfR.filter(function(r){return r._sel;}).length} de {pdfR.length} transacciones</p>
                    <p style={{fontSize:12,color:"#9CA3AF",margin:0}}>Revisa, edita o destilda antes de importar.</p>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={function(){setPdfR(null);}} style={{fontSize:12,padding:"6px 14px",borderRadius:8,border:"1.5px solid #E2DDD6",background:"transparent",cursor:"pointer",color:"#9CA3AF",fontFamily:"inherit"}}>Cancelar</button>
                    <button onClick={confirmarPDF} style={{fontSize:13,padding:"6px 16px",borderRadius:8,border:"none",background:"#1a1f3a",cursor:"pointer",color:"#fff",fontWeight:600,fontFamily:"inherit"}}>Importar seleccionados</button>
                  </div>
                </div>
                <div className="cw" style={{padding:0,overflow:"hidden"}}>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse"}}>
                      <thead>
                        <tr style={{background:"#FAFAF9"}}>
                          <th style={thS}><input type="checkbox" checked={pdfR.every(function(r){return r._sel;})} onChange={function(e){setPdfR(function(p){return p.map(function(r){return Object.assign({},r,{_sel:e.target.checked});});});}}/></th>
                          <th style={thS}>Descripcion</th>
                          <th style={thS}>Periodo</th>
                          <th style={thS}>Categoria</th>
                          <th style={thS}>Quien</th>
                          <th style={thS}>Cuota</th>
                          <th style={Object.assign({},thS,{textAlign:"right"})}>Monto $</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pdfR.map(function(r){
                          return (
                            <tr key={r._id} style={{opacity:r._sel?1:0.4}}>
                              <td style={Object.assign({},tdS,{textAlign:"center"})}><input type="checkbox" checked={r._sel} onChange={function(e){setPR(r._id,"_sel",e.target.checked);}}/></td>
                              <td style={tdS}><input value={r.descripcion} onChange={function(e){setPR(r._id,"descripcion",e.target.value);}} style={{width:"100%",fontSize:12,border:"none",background:"transparent",color:"#1a1a2e",padding:0,fontFamily:"inherit"}}/></td>
                              <td style={Object.assign({},tdS,{whiteSpace:"nowrap"})}>
                                <div style={{display:"flex",gap:4,alignItems:"center"}}>
                                  <select value={r.mes} onChange={function(e){setPR(r._id,"mes",+e.target.value);}} style={{fontSize:11,border:"none",background:"transparent",color:"#1a1a2e",cursor:"pointer",padding:0,fontFamily:"inherit"}}>
                                    {MESES.map(function(l,i){return <option key={i+1} value={i+1}>{l}</option>;})}
                                  </select>
                                  <input type="number" value={r.anio} onChange={function(e){setPR(r._id,"anio",+e.target.value);}} style={{width:44,fontSize:11,border:"none",background:"transparent",color:"#9CA3AF",padding:0,fontFamily:"inherit"}}/>
                                </div>
                              </td>
                              <td style={tdS}>
                                <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
                                  <span style={{width:7,height:7,borderRadius:2,flexShrink:0,background:COLORES[r.etiqueta]||"#ccc"}}/>
                                  <select value={r.etiqueta} onChange={function(e){setPR(r._id,"etiqueta",e.target.value);}} style={{fontSize:11,border:"none",background:"transparent",color:"#1a1a2e",cursor:"pointer",padding:0,maxWidth:110,fontFamily:"inherit"}}>
                                    {CATEGORIAS.map(function(c){return <option key={c} value={c}>{cl(c)}</option>;})}
                                  </select>
                                </span>
                              </td>
                              <td style={tdS}>
                                <select value={r.nombre} onChange={function(e){setPR(r._id,"nombre",e.target.value);}} style={{fontSize:11,border:"none",background:"transparent",color:"#1a1a2e",cursor:"pointer",padding:0,fontFamily:"inherit"}}>
                                  {PERSONAS.map(function(p){return <option key={p}>{p}</option>;})}
                                </select>
                              </td>
                              <td style={Object.assign({},tdS,{whiteSpace:"nowrap"})}>
                                <input value={r.cuota||""} onChange={function(e){setPR(r._id,"cuota",e.target.value);}} placeholder="1/12" style={{width:44,fontSize:11,border:"none",background:"transparent",color:"#9CA3AF",padding:0,fontFamily:"inherit"}}/>
                              </td>
                              <td style={Object.assign({},tdS,{textAlign:"right",whiteSpace:"nowrap"})}>
                                <input type="number" value={r.monto} onChange={function(e){setPR(r._id,"monto",e.target.value);}} style={{width:90,fontSize:12,fontWeight:500,border:"none",background:"transparent",color:"#1a1a2e",padding:0,textAlign:"right",fontFamily:"inherit"}}/>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
            <div style={{height:1,background:"#E8E4DD",margin:"24px 0"}}/>
            <p style={{fontSize:15,fontWeight:700,color:"#1a1f3a",margin:"0 0 4px"}}>Importar desde Excel</p>
            <p style={{fontSize:13,color:"#9CA3AF",marginBottom:10}}>Pega desde Excel. Columnas: Mes / Anio / Descripcion / Cuota / Monto / Categoria / Quien / Medio</p>
            <textarea value={csv} onChange={function(e){setCSV(e.target.value);}} rows={5} placeholder="Pega aqui el contenido..." style={{width:"100%",boxSizing:"border-box",fontSize:12,padding:"10px",border:"1.5px solid #E2DDD6",borderRadius:10,fontFamily:"monospace",background:"#fff",color:"#1a1a2e",resize:"vertical"}}/>
            <div style={{display:"flex",gap:8,margin:"8px 0 20px"}}>
              <button onClick={importCSV} style={{fontSize:13,padding:"7px 16px",borderRadius:8,border:"1.5px solid #E2DDD6",background:"#fff",cursor:"pointer",color:"#1a1f3a",fontFamily:"inherit",fontWeight:500}}>Importar</button>
              <button onClick={function(){saveG([]);saveTC({});saveCer({});notify("Datos eliminados.");}} style={{fontSize:13,padding:"7px 16px",borderRadius:8,border:"1.5px solid #E2DDD6",background:"transparent",cursor:"pointer",color:"#E8303A",fontFamily:"inherit"}}>Borrar todos los datos</button>
            </div>
            <div style={{height:1,background:"#E8E4DD",margin:"0 0 20px"}}/>
            <p style={{fontSize:15,fontWeight:700,color:"#1a1f3a",margin:"0 0 4px"}}>Cargar tipo de cambio MEP (BCRA)</p>
            <p style={{fontSize:13,color:"#9CA3AF",marginBottom:10}}>Pega la tira diaria. Formato: DD/MM/YYYY [tab] valor. La app calcula el promedio mensual automaticamente.</p>
            <textarea value={tcT} onChange={function(e){setTcT(e.target.value);}} rows={4} placeholder={"01/01/2025\t1057,50\n02/01/2025\t1062,00\n..."} style={{width:"100%",boxSizing:"border-box",fontSize:12,padding:"10px",border:"1.5px solid #E2DDD6",borderRadius:10,fontFamily:"monospace",background:"#fff",color:"#1a1a2e",resize:"vertical"}}/>
            <div style={{display:"flex",gap:8,margin:"8px 0 16px"}}>
              <button onClick={importTCStrip} style={{fontSize:13,padding:"7px 16px",borderRadius:8,border:"1.5px solid #E2DDD6",background:"#fff",cursor:"pointer",color:"#1a1f3a",fontFamily:"inherit",fontWeight:500}}>Cargar TC MEP</button>
              <button onClick={function(){saveTC({});notify("TC eliminado.");}} style={{fontSize:13,padding:"7px 16px",borderRadius:8,border:"1.5px solid #E2DDD6",background:"transparent",cursor:"pointer",color:"#E8303A",fontFamily:"inherit"}}>Borrar TC</button>
            </div>
            <div style={{height:1,background:"#E8E4DD",margin:"0 0 20px"}}/>
            <p style={{fontSize:15,fontWeight:700,color:"#1a1f3a",margin:"0 0 4px"}}>Cargar indice CER (BCRA)</p>
            <p style={{fontSize:13,color:"#9CA3AF",marginBottom:10}}>Pega la tira diaria. Formato: DD/MM/YYYY [tab] valor. La app calcula el promedio mensual automaticamente.</p>
            <textarea value={cerT} onChange={function(e){setCerT(e.target.value);}} rows={4} placeholder="31/12/2021  38,64..." style={{width:"100%",boxSizing:"border-box",fontSize:12,padding:"10px",border:"1.5px solid #E2DDD6",borderRadius:10,fontFamily:"monospace",background:"#fff",color:"#1a1a2e",resize:"vertical"}}/>
            <div style={{display:"flex",gap:8,margin:"8px 0 16px"}}>
              <button onClick={importCER} style={{fontSize:13,padding:"7px 16px",borderRadius:8,border:"1.5px solid #E2DDD6",background:"#fff",cursor:"pointer",color:"#1a1f3a",fontFamily:"inherit",fontWeight:500}}>Cargar CER</button>
              <button onClick={function(){saveCer({});notify("CER eliminado.");}} style={{fontSize:13,padding:"7px 16px",borderRadius:8,border:"1.5px solid #E2DDD6",background:"transparent",cursor:"pointer",color:"#E8303A",fontFamily:"inherit"}}>Borrar CER</button>
            </div>
            {Object.keys(cer).length>0 && (
              <div className="cw" style={{marginBottom:14}}>
                <p style={{fontSize:12,fontWeight:600,color:"#1a1f3a",margin:"0 0 8px"}}>{Object.keys(cer).length} meses de CER cargados (promedio mensual)</p>
                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                  {Object.keys(cer).sort().map(function(k){return <span key={k} style={{fontSize:11,padding:"2px 8px",border:"1px solid #E2DDD6",borderRadius:999,color:"#9CA3AF"}}>{k}: {cer[k].toFixed(3)}</span>;})}
                </div>
              </div>
            )}
            <div className="cw">
              <p style={{fontSize:12,fontWeight:600,color:"#1a1f3a",margin:"0 0 8px"}}>TC MEP por mes (promedio mensual)</p>
              <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                {Object.keys(tc).length===0 ? <p style={{fontSize:12,color:"#9CA3AF",margin:0}}>Cache vacio.</p> : Object.keys(tc).sort().map(function(k){return <span key={k} style={{fontSize:11,padding:"2px 8px",border:"1px solid #E2DDD6",borderRadius:999,color:"#9CA3AF"}}>{k}: ${tc[k]}</span>;})}
              </div>
            </div>
          </div>
        )}

        {vista==="exportar" && (
          <div>
            <p className="sec" style={{marginBottom:20}}>Backup de datos</p>
            <div className="cw" style={{marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,flexWrap:"wrap"}}>
                <div>
                  <p style={{fontSize:15,fontWeight:700,color:"#1a1f3a",margin:"0 0 6px"}}>Historial completo</p>
                  <p style={{fontSize:13,color:"#9CA3AF",margin:"0 0 4px"}}>{gastos.length} registros - {mD.length} meses</p>
                  <p style={{fontSize:12,color:"#B8B4AD",margin:0}}>Formato TSV - compatible con Excel</p>
                </div>
                <button onClick={exportar} style={{display:"inline-flex",alignItems:"center",gap:8,padding:"12px 22px",background:"#1a1f3a",color:"#fff",border:"none",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0}}>Descargar backup</button>
              </div>
              {expT && (
                <div style={{marginTop:16}}>
                  <p style={{fontSize:12,color:"#6B7280",margin:"0 0 6px",fontWeight:500}}>Opciones para guardar:</p>
                  <ol style={{fontSize:12,color:"#9CA3AF",margin:"0 0 10px",paddingLeft:18,lineHeight:1.8}}>
                    <li>Click en Copiar todo, abri Excel, pega con Ctrl+V y guarda.</li>
                    <li>O pega el texto en el Bloc de notas y guardalo como gastos_am.tsv</li>
                  </ol>
                  <div style={{position:"relative"}}>
                    <textarea id="g-exp" readOnly value={expT} rows={8} style={{width:"100%",boxSizing:"border-box",fontSize:11,padding:"10px",border:"1.5px solid #E2DDD6",borderRadius:8,fontFamily:"monospace",background:"#F5F3EF",color:"#1a1a2e",resize:"vertical"}}/>
                    <button onClick={function(){var ta=document.getElementById("g-exp");if(ta){ta.select();ta.setSelectionRange(0,ta.value.length);document.execCommand("copy");notify("Copiado! "+gastos.length+" registros.");}}} style={{position:"absolute",top:8,right:8,fontSize:11,padding:"5px 12px",background:"#1a1f3a",color:"#fff",border:"none",borderRadius:6,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Copiar todo</button>
                  </div>
                  <button onClick={function(){setExpT("");}} style={{marginTop:8,fontSize:12,padding:"4px 12px",background:"transparent",border:"1px solid #E2DDD6",borderRadius:6,cursor:"pointer",color:"#9CA3AF",fontFamily:"inherit"}}>Cerrar</button>
                </div>
              )}
            </div>
            <div className="cw">
              <p style={{fontSize:13,fontWeight:600,color:"#1a1f3a",margin:"0 0 6px"}}>Como restaurar?</p>
              <p style={{fontSize:13,color:"#9CA3AF",margin:"0 0 4px"}}>Abri el archivo en Excel, copia el contenido y pegalo en Importar - Excel.</p>
              <p style={{fontSize:12,color:"#B8B4AD",margin:0}}>Recomendamos hacer un backup mensual.</p>
            </div>
          </div>
        )}

        {showF && (
          <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
            <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.55)"}} onClick={function(){setShowF(false);setForm(FORM0);setEI(null);}}/>
            <div style={{position:"relative",width:"100%",maxWidth:500,background:"#fff",borderRadius:12,boxShadow:"0 24px 64px rgba(0,0,0,0.35)",overflow:"hidden"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:"1px solid #e5e5e5"}}>
                <div>
                  <p style={{fontSize:15,fontWeight:600,margin:0,color:"#111"}}>{editId?"Editar gasto":"Nuevo gasto"}</p>
                  <p style={{fontSize:12,color:"#888",margin:"2px 0 0"}}>{MESES[form.mes-1]} {form.anio}</p>
                </div>
                <button onClick={function(){setShowF(false);setForm(FORM0);setEI(null);}} style={{fontSize:20,width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid #e5e5e5",borderRadius:6,background:"transparent",cursor:"pointer",color:"#666"}}>x</button>
              </div>
              <div style={{padding:"20px",display:"flex",flexDirection:"column",gap:14,maxHeight:"65vh",overflowY:"auto"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <div>
                    <p style={{fontSize:11,color:"#666",margin:"0 0 5px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>Mes</p>
                    <select value={form.mes} onChange={function(e){setForm(function(f){return Object.assign({},f,{mes:+e.target.value});});}} style={{width:"100%",fontSize:13,padding:"7px 8px",border:"1px solid #ddd",borderRadius:6,background:"#fafafa",color:"#111",fontFamily:"inherit"}}>
                      {MESES.map(function(l,i){return <option key={i+1} value={i+1}>{l}</option>;})}
                    </select>
                  </div>
                  <div>
                    <p style={{fontSize:11,color:"#666",margin:"0 0 5px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>Anio</p>
                    <input type="number" value={form.anio} onChange={function(e){setForm(function(f){return Object.assign({},f,{anio:+e.target.value});});}} style={{width:"100%",boxSizing:"border-box",fontSize:13,padding:"7px 8px",border:"1px solid #ddd",borderRadius:6,background:"#fafafa",color:"#111",fontFamily:"inherit"}}/>
                  </div>
                </div>
                <div>
                  <p style={{fontSize:11,color:"#666",margin:"0 0 5px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>Descripcion</p>
                  <input autoFocus value={form.descripcion} onChange={function(e){setForm(function(f){return Object.assign({},f,{descripcion:e.target.value});});}} placeholder="Ej: Supermercado Coto" style={{width:"100%",boxSizing:"border-box",fontSize:14,padding:"8px 10px",border:"1px solid #ddd",borderRadius:6,background:"#fafafa",color:"#111",fontFamily:"inherit"}}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:10}}>
                  <div>
                    <p style={{fontSize:11,color:"#666",margin:"0 0 5px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>Monto $</p>
                    <input type="number" value={form.monto} onChange={function(e){setForm(function(f){return Object.assign({},f,{monto:e.target.value});});}} placeholder="0" style={{width:"100%",boxSizing:"border-box",fontSize:16,fontWeight:600,padding:"8px 10px",border:"1px solid #ddd",borderRadius:6,background:"#fafafa",color:"#111",fontFamily:"inherit"}}/>
                  </div>
                  <div>
                    <p style={{fontSize:11,color:"#666",margin:"0 0 5px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>Cuota</p>
                    <input value={form.cuota} onChange={function(e){setForm(function(f){return Object.assign({},f,{cuota:e.target.value});});}} placeholder="3/12" style={{width:"100%",boxSizing:"border-box",fontSize:13,padding:"7px 8px",border:"1px solid #ddd",borderRadius:6,background:"#fafafa",color:"#111",fontFamily:"inherit"}}/>
                  </div>
                </div>
                <div style={{position:"relative"}}>
                  <p style={{fontSize:11,color:"#666",margin:"0 0 5px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>Categoria</p>
                  <div style={{position:"relative",display:"flex",alignItems:"center"}}>
                    {form.etiqueta && <span style={{position:"absolute",left:10,width:8,height:8,borderRadius:2,background:COLORES[form.etiqueta]||"#888",pointerEvents:"none"}}/>}
                    <input
                      value={form._ci!==undefined?form._ci:cl(form.etiqueta)}
                      onChange={function(e){setForm(function(f){return Object.assign({},f,{_ci:e.target.value,_co:true});});}}
                      onFocus={function(){setForm(function(f){return Object.assign({},f,{_ci:cl(f.etiqueta)||"",_co:true});});}}
                      onBlur={function(){setTimeout(function(){setForm(function(f){var inp=f._ci!==undefined?f._ci:"";var match=CATEGORIAS.find(function(c){return cl(c).toLowerCase()===inp.toLowerCase()||c.toLowerCase()===inp.toLowerCase();});return Object.assign({},f,{etiqueta:match||f.etiqueta,_ci:undefined,_co:false});});},150);}}
                      placeholder="Buscar categoria..."
                      style={{width:"100%",boxSizing:"border-box",fontSize:13,padding:"7px 10px 7px "+(form.etiqueta?"26px":"10px"),border:"1px solid #ddd",borderRadius:6,background:"#fafafa",color:"#111",fontFamily:"inherit"}}
                    />
                  </div>
                  {form._co && catM.length>0 && (
                    <div style={{position:"absolute",zIndex:10,top:"100%",left:0,right:0,background:"#fff",border:"1px solid #ddd",borderRadius:6,boxShadow:"0 8px 24px rgba(0,0,0,0.12)",marginTop:2,maxHeight:180,overflowY:"auto"}}>
                      {catM.map(function(c){
                        return (
                          <div key={c} onMouseDown={function(){setForm(function(f){return Object.assign({},f,{etiqueta:c,_ci:undefined,_co:false});});}}
                            style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",cursor:"pointer",background:form.etiqueta===c?"#f0f0f0":"#fff",fontSize:13,color:"#111",fontWeight:form.etiqueta===c?600:400}}
                            onMouseEnter={function(e){e.currentTarget.style.background="#f5f5f5";}}
                            onMouseLeave={function(e){e.currentTarget.style.background=form.etiqueta===c?"#f0f0f0":"#fff";}}>
                            <span style={{width:8,height:8,borderRadius:2,flexShrink:0,background:COLORES[c]||"#888"}}/>
                            {cl(c)}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div>
                  <p style={{fontSize:11,color:"#666",margin:"0 0 7px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>Quien</p>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {PERSONAS.map(function(p){var act=form.nombre===p;return <button key={p} onClick={function(){setForm(function(f){return Object.assign({},f,{nombre:p});});}} style={{fontSize:12,padding:"5px 14px",borderRadius:999,cursor:"pointer",border:act?"1.5px solid #333":"1px solid #e0e0e0",background:act?"#111":"#f5f5f5",color:act?"#fff":"#555",fontWeight:act?600:400,fontFamily:"inherit"}}>{p}</button>;}) }
                  </div>
                </div>
                <div>
                  <p style={{fontSize:11,color:"#666",margin:"0 0 7px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>Medio de pago</p>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {MEDIOS.map(function(m){var act=form.medio===m;return <button key={m} onClick={function(){setForm(function(f){return Object.assign({},f,{medio:m});});}} style={{fontSize:12,padding:"5px 14px",borderRadius:999,cursor:"pointer",border:act?"1.5px solid #333":"1px solid #e0e0e0",background:act?"#111":"#f5f5f5",color:act?"#fff":"#555",fontWeight:act?600:400,fontFamily:"inherit"}}>{cl(m)}</button>;}) }
                  </div>
                </div>
              </div>
              <div style={{display:"flex",gap:8,justifyContent:"flex-end",padding:"14px 20px",borderTop:"1px solid #e5e5e5",background:"#f9f9f9"}}>
                <button onClick={function(){setShowF(false);setForm(FORM0);setEI(null);}} style={{fontSize:13,padding:"7px 16px",borderRadius:6,border:"1px solid #ddd",background:"transparent",cursor:"pointer",color:"#666",fontFamily:"inherit"}}>Cancelar</button>
                {!editId && <button onClick={function(){guardar(true);}} style={{fontSize:13,padding:"7px 16px",borderRadius:6,border:"1px solid #ccc",background:"#fff",cursor:"pointer",color:"#333",fontWeight:500,fontFamily:"inherit"}}>+ Agregar otro</button>}
                <button onClick={function(){guardar(false);}} style={{fontSize:13,padding:"7px 16px",borderRadius:6,border:"none",background:"#111",cursor:"pointer",color:"#fff",fontWeight:600,fontFamily:"inherit"}}>{editId?"Actualizar":"Guardar"}</button>
              </div>
            </div>
          </div>
        )}

        {reporteHtml && (
          <div style={{position:"fixed",inset:0,zIndex:2000,display:"flex",flexDirection:"column",background:"#F5F3EF"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 20px",background:"#1a1f3a",flexShrink:0}}>
              <p style={{fontSize:14,fontWeight:600,color:"#fff",margin:0}}>Reporte — {MESES[fMes-1]} {fAnio}</p>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <button onClick={function(){
                  var iframe=document.getElementById("reporte-iframe");
                  if(iframe&&iframe.contentWindow) iframe.contentWindow.print();
                }} style={{fontSize:13,padding:"7px 16px",borderRadius:8,border:"none",background:"#C49A6C",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>
                  Imprimir / Guardar PDF
                </button>
                <button onClick={function(){setReporteHtml("");}} style={{fontSize:13,padding:"7px 16px",borderRadius:8,border:"1px solid rgba(255,255,255,0.3)",background:"transparent",color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>
                  Cerrar
                </button>
              </div>
            </div>
            <iframe
              id="reporte-iframe"
              srcDoc={reporteHtml}
              style={{flex:1,border:"none",width:"100%"}}
              title="Reporte de gastos"
            />
          </div>
        )}

      </div>
    </div>
  );
}
