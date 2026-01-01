
export function fmtINR(n, currency="INR"){
  // Uses Intl, falls back gracefully.
  try{
    return new Intl.NumberFormat(undefined, {style:"currency", currency, maximumFractionDigits:0}).format(n);
  }catch(e){
    const sign = n < 0 ? "-" : "";
    const x = Math.abs(Math.round(n)).toString();
    return sign + (currency === "INR" ? "₹" : "") + x.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
}

export function pct(a, b){
  // percent change from b -> a
  if(!isFinite(b) || b === 0) return null;
  return ((a - b) / Math.abs(b)) * 100;
}

export function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

export function monthBounds(ym){ // "YYYY-MM"
  const [Y,M] = ym.split("-").map(Number);
  const start = new Date(Date.UTC(Y, M-1, 1));
  const end = new Date(Date.UTC(Y, M, 0)); // last day
  const pad = (x)=> String(x).padStart(2,"0");
  const iso = (d)=> `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
  return {startISO: iso(start), endISO: iso(end)};
}

export function todayISO(){
  const d = new Date();
  const pad = (x)=> String(x).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

export function thisMonth(){
  const d = new Date();
  const pad = (x)=> String(x).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}`;
}

export function prevMonth(ym){
  const [Y,M] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(Y, M-1, 1));
  d.setUTCMonth(d.getUTCMonth()-1);
  const pad = (x)=> String(x).padStart(2,"0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}`;
}

export function uid(){
  // compact id
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

// Simple sparkline draw
export function drawSpark(canvas, series){
  const ctx = canvas.getContext("2d");
  const w = canvas.width = canvas.clientWidth * devicePixelRatio;
  const h = canvas.height = canvas.clientHeight * devicePixelRatio;
  ctx.clearRect(0,0,w,h);

  if(!series || series.length < 2) return;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = (max-min) || 1;

  ctx.lineWidth = 2 * devicePixelRatio;
  ctx.strokeStyle = "rgba(77,163,255,.85)";
  ctx.beginPath();
  series.forEach((v,i)=>{
    const x = (i/(series.length-1)) * (w-2) + 1;
    const y = h - ((v-min)/span) * (h-2) - 1;
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();
}

// Simple line chart (2 series)
export function drawLines(canvas, s1, s2){
  const ctx = canvas.getContext("2d");
  const w = canvas.width = canvas.clientWidth * devicePixelRatio;
  const h = canvas.height = canvas.clientHeight * devicePixelRatio;
  ctx.clearRect(0,0,w,h);

  const all = [...(s1||[]), ...(s2||[])];
  if(all.length < 2) return;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = (max-min) || 1;

  // grid
  ctx.strokeStyle = "rgba(120,160,255,.10)";
  ctx.lineWidth = 1 * devicePixelRatio;
  for(let i=1;i<=4;i++){
    const y = (i/5) * h;
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke();
  }

  function line(series, color){
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 * devicePixelRatio;
    ctx.beginPath();
    series.forEach((v,i)=>{
      const x = (i/(series.length-1)) * (w-10) + 5;
      const y = h - ((v-min)/span) * (h-10) - 5;
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
  }
  line(s1, "rgba(77,163,255,.95)");
  line(s2, "rgba(255,92,92,.90)");
}
