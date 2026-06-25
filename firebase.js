
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, onSnapshot, collection, addDoc,
  query, where, getDocs, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

export {
  initializeApp, getFirestore, doc, setDoc, getDoc, onSnapshot, collection, addDoc,
  query, where, getDocs, deleteDoc, serverTimestamp
};

export const ELECTION_ID = "mainElectionV2";

export const DEFAULT_SETTINGS = {
  password:"0000",
  schoolName:"○○고등학교",
  electionName:"47대 학생회장 선거",
  gradeCount:3,
  classCount:10,
  candidates:[
    {num:1,name:"후보1"},
    {num:2,name:"후보2"},
    {num:3,name:"후보3"}
  ],
  classes:{}
};

export const DEFAULT_STATIONS = {
  grade1:{name:"제1투표소",grade:1,currentClass:"1-1",isOpen:false},
  grade2:{name:"제2투표소",grade:2,currentClass:"2-1",isOpen:false},
  grade3:{name:"제3투표소",grade:3,currentClass:"3-1",isOpen:false}
};

export function parseFirebaseInput(raw){
  let text=(raw||"").trim();
  if(!text) throw new Error("Firebase 설정값을 입력하세요.");
  const match=text.match(/firebaseConfig\s*=\s*(\{[\s\S]*?\})\s*;?/);
  if(match) text=match[1];
  text=text
    .replace(/^\s*const\s+firebaseConfig\s*=\s*/,"")
    .replace(/;\s*$/,"")
    .replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g,'$1"$2":')
    .replace(/'/g,'"');
  return JSON.parse(text);
}

export function getFirebaseConfig(){
  try { return JSON.parse(localStorage.getItem("schoolVoteV2Firebase") || "null"); }
  catch(e){ return null; }
}

export function saveFirebaseConfig(raw){
  const cfg=parseFirebaseInput(raw);
  if(!cfg.apiKey || !cfg.projectId || !cfg.appId) {
    throw new Error("apiKey, projectId, appId가 포함되어야 합니다.");
  }
  localStorage.setItem("schoolVoteV2Firebase", JSON.stringify(cfg));
  return cfg;
}

export function createFirebase(){
  const cfg=getFirebaseConfig();
  if(!cfg) return {app:null, db:null, cfg:null};
  const app=initializeApp(cfg);
  const db=getFirestore(app);
  return {app, db, cfg};
}

export function ensureClasses(settings){
  const gc=Number(settings.gradeCount)||3;
  const cc=Number(settings.classCount)||10;
  if(!settings.classes) settings.classes={};
  for(let g=1; g<=gc; g++){
    for(let c=1; c<=cc; c++){
      const key=`${g}-${c}`;
      if(!settings.classes[key]) settings.classes[key]={grade:g,classNo:c,total:28};
    }
  }
}

export function ensureStations(settings, stations){
  const gc=Number(settings.gradeCount)||3;
  for(let g=1; g<=gc; g++){
    const key=`grade${g}`;
    if(!stations[key]) stations[key]={name:`제${g}투표소`,grade:g,currentClass:`${g}-1`,isOpen:false};
  }
}

export function refs(db){
  return {
    settingsRef: doc(db, "schoolVoteV2", ELECTION_ID, "config", "settings"),
    stationsRef: doc(db, "schoolVoteV2", ELECTION_ID, "config", "stations"),
    votesCol: collection(db, "schoolVoteV2", ELECTION_ID, "votes")
  };
}

export function withTimeout(promise, ms=10000, label="작업"){
  return Promise.race([
    promise,
    new Promise((_, reject)=>setTimeout(()=>reject(new Error(`${label} 시간이 초과되었습니다. Firebase 연결을 확인하세요.`)), ms))
  ]);
}

export function escapeHtml(text){
  return String(text ?? "").replace(/[&<>"']/g, (ch)=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[ch]));
}
