const { createClient } = supabase;
const db = createClient(PSCGRAM_CONFIG.SUPABASE_URL, PSCGRAM_CONFIG.SUPABASE_PUBLISHABLE_KEY);
const PREMIUM_URL = `${PSCGRAM_CONFIG.SUPABASE_URL}/functions/v1/premium-membership`;
const $ = id => document.getElementById(id);

function msg(text, ok=false){
  const el=$('premiumMessage'); if(!el)return;
  el.textContent=text; el.className='auth-message '+(ok?'success':'error');
}

async function callPremium(body){
  const {data:{session}}=await db.auth.getSession();
  if(!session) throw new Error('Please log in first.');
  const r=await fetch(PREMIUM_URL,{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'apikey':PSCGRAM_CONFIG.SUPABASE_PUBLISHABLE_KEY,
      'Authorization':`Bearer ${session.access_token}`
    },
    body:JSON.stringify(body)
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok || !data.success) throw new Error(data.error || 'Premium service error');
  return data;
}

async function refreshStatus(){
  try{
    const {data:{session}}=await db.auth.getSession();
    if(!session){
      $('premiumState').textContent='Login required';
      $('joinPremium')?.classList.remove('hidden');
      $('loginPremium')?.classList.remove('hidden');
      return;
    }
    const data=await callPremium({action:'status'});
    if(data.active){
      const d=new Date(data.membership.expires_at);
      $('premiumState').textContent=`PREMIUM ACTIVE • Access until ${d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}`;
      $('joinPremium')?.classList.add('hidden');
      $('loginPremium')?.classList.add('hidden');
      $('premiumActiveBox')?.classList.remove('hidden');
    }else{
      $('premiumState').textContent='Not a Premium Member';
      $('joinPremium')?.classList.remove('hidden');
      $('loginPremium')?.classList.add('hidden');
    }
  }catch(e){ msg(e.message); }
}

$('loginPremium')?.addEventListener('click',()=>location.href='login.html?redirect=pricing.html');
$('joinPremium')?.addEventListener('click',async()=>{
  try{
    msg('Creating secure payment…');
    const {data:{session}}=await db.auth.getSession();
    if(!session){ location.href='login.html?redirect=pricing.html'; return; }

    const order=await callPremium({action:'create_order'});
    const options={
      key:order.key_id,
      amount:order.amount,
      currency:'INR',
      name:'PSCGram',
      description:'Premium Membership — 1 Year Complete Access',
      order_id:order.order_id,
      prefill:{email:order.email},
      theme:{color:'#155eef'},
      handler:async function(response){
        try{
          msg('Verifying payment…');
          await callPremium({
            action:'verify',
            razorpay_order_id:response.razorpay_order_id,
            razorpay_payment_id:response.razorpay_payment_id,
            razorpay_signature:response.razorpay_signature
          });
          msg('Payment successful! Premium access is now active.',true);
          setTimeout(()=>location.href='premium-member.html',700);
        }catch(e){msg(e.message);}
      },
      modal:{ondismiss:()=>msg('Payment window closed. You can try again anytime.')}
    };
    const rzp=new Razorpay(options);
    rzp.on('payment.failed',r=>msg(r.error?.description || 'Payment failed. Please try again.'));
    rzp.open();
  }catch(e){msg(e.message);}
});

(async()=>{ if($('year'))$('year').textContent=new Date().getFullYear(); await refreshStatus(); })();
