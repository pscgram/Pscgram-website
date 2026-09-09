const { createClient } = supabase;
const db = createClient(PSCGRAM_CONFIG.SUPABASE_URL, PSCGRAM_CONFIG.SUPABASE_PUBLISHABLE_KEY);
const $ = id => document.getElementById(id);

function showMessage(text, ok=false){ const el=$('authMessage'); if(!el)return; el.textContent=text; el.className='auth-message '+(ok?'success':'error'); }
function setMode(mode){
  const login=mode!=='signup';
  $('loginTab')?.classList.toggle('active',login); $('signupTab')?.classList.toggle('active',!login);
  $('loginForm')?.classList.toggle('hidden',!login); $('signupForm')?.classList.toggle('hidden',login);
  showMessage('');
}

$('loginTab')?.addEventListener('click',()=>setMode('login'));
$('signupTab')?.addEventListener('click',()=>setMode('signup'));

$('loginForm')?.addEventListener('submit', async e=>{
  e.preventDefault(); showMessage('Signing you in…');
  const {data,error}=await db.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});
  if(error){showMessage(error.message);return;}
  showMessage('Login successful. Opening your member area…',true);
  setTimeout(()=>location.href=(new URLSearchParams(location.search).get('redirect')||'member.html'),350);
});

$('signupForm')?.addEventListener('submit', async e=>{
  e.preventDefault();
  if($('signupPassword').value!==$('signupConfirm').value){showMessage('Passwords do not match.');return;}
  showMessage('Creating your account…');
  const {data,error}=await db.auth.signUp({email:$('signupEmail').value.trim(),password:$('signupPassword').value});
  if(error){showMessage(error.message);return;}
  if(data.session){showMessage('Account created. Opening your member area…',true);setTimeout(()=>location.href=(new URLSearchParams(location.search).get('redirect')||'member.html'),350);}
  else showMessage('Account created. Please check your email to confirm your account, then log in.',true);
});

(async()=>{
  const {data:{session}}=await db.auth.getSession();
  if(session && location.pathname.endsWith('/login.html')){
    // Keep the login page available, but offer the signed-in member area.
    showMessage('You are already signed in. Opening your member area…',true);
    setTimeout(()=>location.href=(new URLSearchParams(location.search).get('redirect')||'member.html'),500);
  }
  const params=new URLSearchParams(location.search); if(params.get('mode')==='signup')setMode('signup');
})();
if($('year'))$('year').textContent=new Date().getFullYear();
