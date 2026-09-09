const { createClient } = supabase;
const db = createClient(PSCGRAM_CONFIG.SUPABASE_URL, PSCGRAM_CONFIG.SUPABASE_PUBLISHABLE_KEY);
const $=id=>document.getElementById(id);
async function initMember(){
  const {data:{session},error}=await db.auth.getSession();
  if(error||!session){location.href='login.html';return;}
  const email=session.user.email||'Member'; $('memberEmail').textContent=email;
  let premium=null;
  try{
    const r=await db.from('premium_memberships').select('status,expires_at').eq('user_id',session.user.id).order('expires_at',{ascending:false}).limit(1).maybeSingle();
    if(!r.error)premium=r.data;
  }catch(_){}
  const active=premium && premium.status==='active' && new Date(premium.expires_at)>new Date();
  if(active){
    $('memberBadge').textContent='PREMIUM MEMBER'; $('memberBadge').classList.add('premium');
    $('statusTitle').textContent='Premium Membership Active';
    $('statusText').textContent='Complete access is active until '+new Date(premium.expires_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})+'.';
    $('statusAction').innerHTML='<a class="btn premium-join" href="pricing.html">Manage / Renew Premium →</a>';
  }
  $('logoutTop')?.addEventListener('click',async()=>{await db.auth.signOut();location.href='index.html';});
  if($('year'))$('year').textContent=new Date().getFullYear();
}
initMember();
