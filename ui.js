document.addEventListener("DOMContentLoaded",()=>{
  const toggle=document.querySelector(".menu-toggle");
  const nav=document.getElementById("site-nav");
  const closeMenu=()=>{
    if(!nav||!toggle)return;
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded","false");
    toggle.setAttribute("aria-label","Open menu");
    toggle.textContent="☰";
  };
  if(toggle&&nav){
    toggle.addEventListener("click",(event)=>{
      event.stopPropagation();
      const open=nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded",String(open));
      toggle.setAttribute("aria-label",open?"Close menu":"Open menu");
      toggle.textContent=open?"✕":"☰";
    });
    nav.querySelectorAll("a").forEach(a=>a.addEventListener("click",closeMenu));
    document.addEventListener("click",event=>{
      if(nav.classList.contains("open")&&!nav.contains(event.target)&&event.target!==toggle)closeMenu();
    });
    window.addEventListener("resize",()=>{if(window.innerWidth>800)closeMenu();});
  }
  const year=document.getElementById("year");
  if(year)year.textContent=new Date().getFullYear();
});
