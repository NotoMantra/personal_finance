
/*
  PFOS state layer (local-only):
  - IndexedDB: transactions
  - localStorage: tiny settings cache (optional)
  - BroadcastChannel: cross-widget sync

  Data model:
    settings stored in meta store under key `settings:${profile}`
    transactions:
      { id, profile, date(YYYY-MM-DD), desc, category, account, type, amount, tags[], note }
      plus pdate = `${profile}|${date}` for fast month-range queries
*/
const DB_NAME = "pfos";
const DB_VER = 1;
const CH = "pfos-sync";

let _db = null;

function openDB(){
  if(_db) return Promise.resolve(_db);
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (e)=>{
      const db = req.result;
      if(!db.objectStoreNames.contains("transactions")){
        const tx = db.createObjectStore("transactions", {keyPath:"id"});
        tx.createIndex("pdate", "pdate", {unique:false});
        tx.createIndex("profile", "profile", {unique:false});
        tx.createIndex("date", "date", {unique:false});
      }
      if(!db.objectStoreNames.contains("meta")){
        db.createObjectStore("meta", {keyPath:"key"});
      }
    };
    req.onsuccess = ()=>{ _db = req.result; resolve(_db); };
    req.onerror = ()=> reject(req.error);
  });
}

function txStore(db, name, mode="readonly"){
  return db.transaction(name, mode).objectStore(name);
}

export const bus = ("BroadcastChannel" in window) ? new BroadcastChannel(CH) : null;

export function emitChanged(scope){
  try{
    if(bus) bus.postMessage({type:"DATA_CHANGED", scope, at: Date.now()});
    // local fallback ping
    localStorage.setItem("pfos:lastChanged", JSON.stringify({scope, at: Date.now()}));
  }catch(e){}
}

export function onChanged(handler){
  if(bus){
    bus.onmessage = (ev)=>{ if(ev?.data?.type==="DATA_CHANGED") handler(ev.data); };
  }
  window.addEventListener("storage", (ev)=>{
    if(ev.key === "pfos:lastChanged" && ev.newValue){
      try{ handler(JSON.parse(ev.newValue)); }catch(e){}
    }
  });
}

export async function getSettings(profile="default"){
  const db = await openDB();
  const store = txStore(db, "meta", "readonly");
  const key = `settings:${profile}`;
  const val = await new Promise((resolve)=>{
    const r = store.get(key);
    r.onsuccess = ()=> resolve(r.result?.value ?? null);
    r.onerror = ()=> resolve(null);
  });
  if(val) return val;

  // default settings
  const defaults = {
    profile,
    currency: "USD",
    monthStartDay: 1,
    categories: ["Rent","Groceries","Dining","Transport","Utilities","Shopping","Health","EMI","Entertainment","Investments","Income"],
    accounts: ["Bank","Credit Card","Wallet","Savings"],
    budgets: {
      Rent: 25000, Groceries: 8000, Dining: 4000, Transport: 3000, Utilities: 3000, Shopping: 3000, Health: 2000, EMI: 12000, Entertainment: 2000
    }
  };
  await setSettings(profile, defaults);
  return defaults;
}

export async function setSettings(profile, settings){
  const db = await openDB();
  const store = txStore(db, "meta", "readwrite");
  const rec = {key:`settings:${profile}`, value: settings};
  await new Promise((resolve, reject)=>{
    const r = store.put(rec);
    r.onsuccess = ()=> resolve(true);
    r.onerror = ()=> reject(r.error);
  });
  emitChanged("settings");
}

export async function seedIfEmpty(profile="default"){
  const count = await countTransactions(profile);
  if(count > 0) return false;

  const sample = [
    {date: "2026-01-02", desc:"Salary", category:"Income", account:"Bank", type:"Income", amount: 120000},
    {date: "2026-01-03", desc:"Rent", category:"Rent", account:"Bank", type:"Expense", amount: 28000},
    {date: "2026-01-04", desc:"Groceries", category:"Groceries", account:"Bank", type:"Expense", amount: 2200},
    {date: "2026-01-05", desc:"Metro/Bus", category:"Transport", account:"Bank", type:"Expense", amount: 180},
    {date: "2026-01-06", desc:"Electricity", category:"Utilities", account:"Bank", type:"Expense", amount: 1450},
    {date: "2026-01-08", desc:"Dining out", category:"Dining", account:"Credit Card", type:"Expense", amount: 850},
    {date: "2026-01-12", desc:"Gym", category:"Health", account:"Bank", type:"Expense", amount: 1600},
    {date: "2026-01-18", desc:"Shopping", category:"Shopping", account:"Credit Card", type:"Expense", amount: 2400},
    {date: "2026-01-25", desc:"SIP", category:"Investments", account:"Bank", type:"Expense", amount: 5000},
  ];

  for(const t of sample) await upsertTransaction(profile, t);
  emitChanged("transactions");
  return true;
}

export async function countTransactions(profile="default"){
  const db = await openDB();
  const store = txStore(db, "transactions", "readonly");
  const idx = store.index("profile");
  return await new Promise((resolve)=>{
    const r = idx.count(profile);
    r.onsuccess = ()=> resolve(r.result || 0);
    r.onerror = ()=> resolve(0);
  });
}

export async function upsertTransaction(profile, tx){
  const db = await openDB();
  const store = txStore(db, "transactions", "readwrite");
  const id = tx.id || crypto?.randomUUID?.() || (Math.random().toString(16).slice(2)+Date.now().toString(16));
  const rec = {
    id,
    profile,
    date: tx.date,
    desc: tx.desc || "",
    category: tx.category || "Uncategorized",
    account: tx.account || "Bank",
    type: tx.type || "Expense",
    amount: Number(tx.amount || 0),
    tags: Array.isArray(tx.tags) ? tx.tags : [],
    note: tx.note || "",
  };
  rec.pdate = `${profile}|${rec.date}`;

  await new Promise((resolve, reject)=>{
    const r = store.put(rec);
    r.onsuccess = ()=> resolve(true);
    r.onerror = ()=> reject(r.error);
  });
  emitChanged("transactions");
  return rec;
}

export async function deleteTransaction(id){
  const db = await openDB();
  const store = txStore(db, "transactions", "readwrite");
  await new Promise((resolve, reject)=>{
    const r = store.delete(id);
    r.onsuccess = ()=> resolve(true);
    r.onerror = ()=> reject(r.error);
  });
  emitChanged("transactions");
}

export async function listTransactionsByMonth(profile, ym){ // ym: YYYY-MM
  const db = await openDB();
  const store = txStore(db, "transactions", "readonly");
  const idx = store.index("pdate");

  const start = `${profile}|${ym}-01`;
  const end = `${profile}|${ym}-31`;
  const range = IDBKeyRange.bound(start, end);

  const out = await new Promise((resolve)=>{
    const req = idx.getAll(range);
    req.onsuccess = ()=> resolve(req.result || []);
    req.onerror = ()=> resolve([]);
  });

  // sort descending date
  out.sort((a,b)=> (a.date < b.date ? 1 : -1));
  return out;
}

export function summarize(transactions){
  let income = 0, expense = 0;
  for(const t of transactions){
    const amt = Number(t.amount||0);
    if((t.type||"").toLowerCase() === "income") income += amt;
    else expense += amt;
  }
  return {income, expense, net: income-expense};
}

export function categoryTotals(transactions, limit=6){
  const m = new Map();
  for(const t of transactions){
    if((t.type||"").toLowerCase() === "income") continue;
    const k = t.category || "Uncategorized";
    m.set(k, (m.get(k) || 0) + Number(t.amount||0));
  }
  const arr = [...m.entries()].map(([k,v])=>({category:k, amount:v}));
  arr.sort((a,b)=> b.amount - a.amount);
  return arr.slice(0, limit);
}

export function weeklySeries(transactions, ym){
  // 4 buckets: week1(1-7), week2(8-14), week3(15-21), week4(22-end)
  const buckets = [0,0,0,0];
  const buckets2 = [0,0,0,0]; // income
  for(const t of transactions){
    if(!t.date?.startsWith(ym)) continue;
    const day = Number(t.date.slice(8,10));
    const idx = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3;
    const amt = Number(t.amount||0);
    if((t.type||"").toLowerCase() === "income") buckets2[idx] += amt;
    else buckets[idx] += amt;
  }
  return {expense: buckets, income: buckets2};
}
