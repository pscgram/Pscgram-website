const { createClient } = supabase;
const db = createClient(PSCGRAM_CONFIG.SUPABASE_URL, PSCGRAM_CONFIG.SUPABASE_PUBLISHABLE_KEY);

const demo = [
  {category:"National",title:"Daily PSC current affairs update",note:"A short exam-oriented note will appear here when the day's current-affairs entry is published from the PSCGram Admin panel.",points:["Add the key fact","Remember the related organisation/person","Revise before the daily quiz"]},
  {category:"Kerala",title:"Kerala-focused update",note:"Publish Kerala news in 2–3 simple lines so aspirants can revise it quickly.",points:["Kerala PSC relevance","Important place/person","One-line takeaway"]},
  {category:"International",title:"International update",note:"Use this card for important world events, reports, summits and organisations.",points:["Country / organisation","Important date","Exam-ready fact"]},
  {category:"Science & Tech",title:"Science & Technology update",note:"Keep technical news simple and focus on the fact likely to be asked in an exam.",points:["Technology / mission","Organisation","Key fact"]},
  {category:"Sports",title:"Sports update",note:"Record important winners, venues, records and tournaments in a compact format.",points:["Event","Winner / result","Important record"]}
];

let items=[], category="All";

const $=id=>document.getElementById(id);
function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}

function render(){
  const list=$("ca-list");
  const filtered=category==="All"?items:items.filter(x=>x.category===category);
  list.innerHTML=filtered.map((x,i)=>`
    <article class="ca-card">
      <div class="ca-index">${String(i+1).padStart(2,"0")}</div>
      <div class="ca-body">
        <div class="ca-meta"><span class="ca-cat">${esc(x.category||"General")}</span><span>${esc(x.date_label||"Today")}</span></div>
        <h3>${esc(x.title)}</h3>
        <p>${esc(x.note)}</p>
        ${Array.isArray(x.points)&&x.points.length?`<div class="ca-points">${x.points.slice(0,4).map(p=>`<span>✓ ${esc(p)}</span>`).join("")}</div>`:""}
      </div>
    </article>`).join("") || `<div class="empty">No entries in this category yet.</div>`;
}

async function load(){
  $("ca-status").textContent="Loading…";
  const {data,error}=await db.from("current_affairs").select("*").eq("is_published",true).order("published_date",{ascending:false}).order("sort_order",{ascending:true});
  if(error){
    items=demo;
    $("ca-status").textContent="Preview";
  }else{
    items=data?.length?data:demo;
    $("ca-status").textContent=data?.length?`${data.length} updates`:"Preview";
  }
  render();
}

document.querySelectorAll(".ca-filter").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll(".ca-filter").forEach(x=>x.classList.remove("active"));
  b.classList.add("active"); category=b.dataset.cat; render();
}));
document.querySelectorAll(".date-chip").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll(".date-chip").forEach(x=>x.classList.remove("active")); b.classList.add("active");
}));
$("year").textContent=new Date().getFullYear();
load();