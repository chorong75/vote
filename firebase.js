
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
export const ADMIN_FALLBACK_PASSWORD = "8975";

export const DEFAULT_SETTINGS = {
  password:"8975",
  schoolName:"○○고등학교",
  electionName:"47대 학생회장 선거",
  gradeCount:3,
  classCount:10, // 기존 설정 호환용 기본값
  classCounts:{1:10,2:10,3:10},
  candidates:[
    {num:1,name:"윤금채, 김세현, 이자연"},
    {num:2,name:"위서준, 정지범, 강지수"},
    {num:3,name:"장인영, 장채윤, 이서준"},
    {num:4,name:"기권"}
  ],
  classes:{}
};

export const DEFAULT_STATIONS = {
  grade1:{name:"제 1투표소",location:"",grade:1,currentClass:"1-1",isOpen:false},
  grade2:{name:"제 2투표소",location:"",grade:2,currentClass:"2-1",isOpen:false},
  grade3:{name:"제 3투표소",location:"",grade:3,currentClass:"3-1",isOpen:false}
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

export function ensureClassCounts(settings){
  const gc=Number(settings.gradeCount)||3;
  const legacy=Number(settings.classCount)||10;
  if(!settings.classCounts || typeof settings.classCounts!=="object") settings.classCounts={};
  for(let g=1; g<=gc; g++){
    const value=Number(settings.classCounts[g]);
    settings.classCounts[g]=value>0 ? value : legacy;
  }
  // 예전 버전의 classCount는 첫 학년 값을 보관해 호환성을 유지합니다.
  settings.classCount=Number(settings.classCounts[1])||legacy;
  return settings.classCounts;
}

export function getClassCount(settings, grade){
  ensureClassCounts(settings);
  return Number(settings.classCounts?.[grade]) || Number(settings.classCount) || 10;
}

export function ensureClasses(settings){
  const gc=Number(settings.gradeCount)||3;
  ensureClassCounts(settings);
  if(!settings.classes) settings.classes={};
  for(let g=1; g<=gc; g++){
    const cc=getClassCount(settings,g);
    for(let c=1; c<=cc; c++){
      const key=`${g}-${c}`;
      if(!settings.classes[key]) settings.classes[key]={grade:g,classNo:c,total:28};
    }
  }
}

export function ensureStations(settings, stations){
  const gc=Number(settings.gradeCount)||3;
  ensureClassCounts(settings);
  for(let g=1; g<=gc; g++){
    const key=`grade${g}`;
    const firstClass=`${g}-1`;
    if(!stations[key]) stations[key]={name:`제 ${g}투표소`,location:"",grade:g,currentClass:firstClass,isOpen:false};
    if(stations[key].location===undefined) stations[key].location="";
    const currentNo=Number(String(stations[key].currentClass||"").split("-")[1]);
    if(!currentNo || currentNo>getClassCount(settings,g)){
      stations[key].currentClass=firstClass;
      stations[key].isOpen=false;
    }
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
