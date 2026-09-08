const { createClient } = supabase;
const db = createClient(PSCGRAM_CONFIG.SUPABASE_URL, PSCGRAM_CONFIG.SUPABASE_PUBLISHABLE_KEY);
const SUPABASE_URL = PSCGRAM_CONFIG.SUPABASE_URL;
const CREATE_PAYMENT_URL = `${SUPABASE_URL}/functions/v1/create-payment`;
const VERIFY_PAYMENT_URL = `${SUPABASE_URL}/functions/v1/verify-payment`;
const DOWNLOAD_PDF_URL = `${SUPABASE_URL}/functions/v1/download-pdf`;
const SECURE_EXAM_URL = `${SUPABASE_URL}/functions/v1/paid-exam`;
const $ = id => document.getElementById(id);
function esc(v = "") { return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
if ($('year')) $('year').textContent = new Date().getFullYear();

async function loadProducts() {
  const productsEl = $('products'), statusEl = $('status'); if (!productsEl) return;
  const { data, error } = await db.from('products').select('id,title,description,price,cover_url,created_at').order('created_at',{ascending:false});
  if (error) { statusEl.textContent='Could not load materials'; console.error(error); return; }
  statusEl.textContent=`${data.length} material${data.length===1?'':'s'}`;
  if (!data.length) { $('empty')?.classList.remove('hidden'); return; }
  productsEl.innerHTML=data.map(p=>`<article class="product">
    <div class="cover">${p.cover_url?`<img src="${esc(p.cover_url)}" alt="${esc(p.title)}">`:`<div class="cover-placeholder"><span>PSC</span><strong>GRAM</strong><small>PREMIUM PDF</small></div>`}</div>
    <div class="product-body"><div class="tag">PDF • PREMIUM MATERIAL</div><h3>${esc(p.title)}</h3><p>${esc(p.description||'Premium PSC study material.')}</p>
    <div class="product-foot"><strong>₹${Number(p.price||0).toFixed(0)}</strong><button class="btn primary buy-btn" data-id="${esc(String(p.id))}" data-title="${esc(p.title)}">Buy Now</button></div></div></article>`).join('');
}

async function startPayment(productId,title){
  if(typeof Razorpay==='undefined'){alert('Payment system could not load. Please try again.');return;}
  const statusEl=$('status');
  try{
    statusEl.textContent='Creating secure payment…';
    const r=await fetch(CREATE_PAYMENT_URL,{method:'POST',headers:{'Content-Type':'application/json','apikey':PSCGRAM_CONFIG.SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify({product_id:productId})});
    const d=await r.json(); if(!r.ok||!d.success) throw new Error(d.error||'Could not create payment order');
    const rzp=new Razorpay({key:d.key_id,order_id:d.order_id,amount:d.amount,currency:d.currency||'INR',name:'PSCGram',description:d.product_title||title,image:'',notes:{product_id:String(d.product_id)},theme:{color:'#155eef'},handler:response=>verifyPayment(response),modal:{ondismiss:()=>statusEl.textContent='Ready for payment'}});
    rzp.on('payment.failed',x=>{console.error(x.error);statusEl.textContent='Payment failed';alert('Payment failed. Please try again.');});
    statusEl.textContent='Ready for payment'; rzp.open();
  }catch(e){console.error(e);statusEl.textContent='Payment error';alert(e.message||'Could not start payment.');}
}
async function verifyPayment(response){
  const statusEl=$('status'); try{
    statusEl.textContent='Verifying payment securely…';
    const r=await fetch(VERIFY_PAYMENT_URL,{method:'POST',headers:{'Content-Type':'application/json','apikey':PSCGRAM_CONFIG.SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify({razorpay_order_id:response.razorpay_order_id,razorpay_payment_id:response.razorpay_payment_id,razorpay_signature:response.razorpay_signature})});
    const d=await r.json(); if(!r.ok||!d.success||!d.download_token) throw new Error(d.error||'Payment verification failed');
    statusEl.textContent='Payment verified. Preparing your PDF…';
    const dr=await fetch(DOWNLOAD_PDF_URL,{method:'POST',headers:{'Content-Type':'application/json','apikey':PSCGRAM_CONFIG.SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify({download_token:d.download_token})});
    const dd=await dr.json(); if(!dr.ok||!dd.success||!dd.download_url) throw new Error(dd.error||'Could not prepare the PDF');
    statusEl.textContent='PDF ready — opening…'; window.location.href=dd.download_url;
  }catch(e){console.error(e);statusEl.textContent='Could not deliver PDF';alert((e.message||'Something went wrong')+'\n\nIf money was deducted, please contact PSCGram support before paying again.');}
}
document.addEventListener('click',e=>{const b=e.target.closest('.buy-btn');if(b)startPayment(b.dataset.id,b.dataset.title);});

async function loadHomeExams(){
  const box=$('home-exams'); if(!box)return;
  const {data,error}=await db.from('exams').select('id,title,description,duration_minutes,total_marks,is_paid,price').eq('is_published',true).order('created_at',{ascending:false});
  if(error){box.innerHTML='<div class="loading-card">Online exams are temporarily unavailable.</div>';return;}
  if(!data?.length){box.innerHTML='<div class="loading-card">No online exams published yet.</div>';return;}
  box.innerHTML=data.slice(0,6).map(e=>`<article class="home-exam-card ${e.is_paid?'paid-exam-card':''}"><div class="exam-badge">${e.is_paid?'PAID EXAM':'FREE EXAM'}</div><h3>${esc(e.title)}</h3><p>${esc(e.description||'PSC-focused online mock test.')}</p><div class="home-exam-meta"><span>⏱ ${e.duration_minutes} min</span><span>🎯 ${e.total_marks} marks</span><strong>${e.is_paid?'₹'+Number(e.price||0).toFixed(0):'FREE'}</strong></div><a class="btn ${e.is_paid?'primary':'ghost'}" href="exam.html?exam=${encodeURIComponent(e.id)}">${e.is_paid?'Pay & Start':'Start Exam'}</a></article>`).join('');
}
loadProducts(); loadHomeExams();
