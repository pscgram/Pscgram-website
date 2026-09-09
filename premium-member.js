const { createClient } = supabase;
const db = createClient(PSCGRAM_CONFIG.SUPABASE_URL, PSCGRAM_CONFIG.SUPABASE_PUBLISHABLE_KEY);
const URL= `${PSCGRAM_CONFIG.SUPABASE_URL}/functions/v1/premium-membership`;
(async()=>{
  const status=document.getElementById('pmStatus'), content=document.getElementById('pmContent'), denied=document.getElementById('pmDenied');
  try{
    const {data:{session}}=await db.auth.getSession();
    if(!session){location.href='login.html?redirect=premium-member.html';return;}
    const r=await fetch(URL,{method:'POST',headers:{'Content-Type':'application/json','apikey':PSCGRAM_CONFIG.SUPABASE_PUBLISHABLE_KEY,'Authorization':`Bearer ${session.access_token}`},body:JSON.stringify({action:'status'})});
    const d=await r.json();
    if(!d.success) throw new Error(d.error||'Could not check membership.');
    if(d.active){
      const expiry=new Date(d.membership.expires_at);
      status.textContent=`Active until ${expiry.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}.`;
      content.classList.remove('hidden'); denied.classList.add('hidden');
    }else{
      status.textContent='No active Premium Membership.';
    }
  }catch(e){status.textContent=e.message;}
  if(document.getElementById('year'))document.getElementById('year').textContent=new Date().getFullYear();
})();
