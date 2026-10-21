const $=id=>document.getElementById(id);
const task=$("task"),backend=$("backend"),notice=$("notice"),result=$("result");
backend.value=localStorage.getItem("cf-backend")||"";
function msg(t,c=""){notice.textContent=t;notice.className="notice "+c}
function setBackend(){
  const v=backend.value.trim().replace(/\/$/,"");
  localStorage.setItem("cf-backend",v);
  $("backendLabel").textContent=v?v.replace(/^https?:\/\//,"").slice(0,32):"Not configured";
  $("engine").textContent=v?"Backend configured":"Preview mode";
  $("engineHint").textContent=v?"Claude API available if configured on server":"Backend not connected";
}
backend.addEventListener("change",setBackend);
backend.addEventListener("blur",setBackend);
task.addEventListener("input",()=>$("count").textContent=task.value.length+" / 12000");
$("plan").addEventListener("click",()=>{
  if(!task.value.trim())return msg("Describe the task first.","error");
  result.hidden=false;
  result.textContent="SAFE PLAN PREVIEW\n1. Clarify the goal and inspect the relevant context.\n2. Propose a concise plan.\n3. Ask approval before risky operations.\n4. Implement a focused change.\n5. Test and summarize results.\n\nPreview only: no agent tools were run and no files were changed.";
  msg("Preview plan created. No files were changed.","good");
});
$("run").addEventListener("click",async()=>{
  const url=backend.value.trim().replace(/\/$/,"");
  if(!task.value.trim())return msg("Describe the task first.","error");
  if(!url){
    result.hidden=false;
    result.textContent="No backend configured. The browser must not contain your Anthropic API key. Deploy the backend securely, set ANTHROPIC_API_KEY there, then enter its HTTPS URL.";
    return msg("Connect a secured backend to use real Claude.");
  }
  if(!/^https:\/\//i.test(url)&&!/^http:\/\/localhost(?::\d+)?$/i.test(url))return msg("Use HTTPS for remote backends. HTTP is allowed only for localhost.","error");
  $("run").disabled=true;msg("Sending request to Claude…");
  try{
    const r=await fetch(url+"/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:task.value})});
    const data=await r.json();
    if(!r.ok)throw Error(data.detail||data.error||"Backend request failed");
    result.hidden=false;
    result.textContent=(data.model?"Model: "+data.model+"\n\n":"")+(data.answer||JSON.stringify(data,null,2));
    msg("Claude replied. This chat endpoint does not modify project files.","good");
  }catch(e){
    result.hidden=false;
    result.textContent="Claude request failed: "+e.message+"\nCheck the backend URL, ALLOWED_ORIGINS, API key, model access and server logs.";
    msg("Could not reach Claude. Check backend configuration.","error");
  }finally{$("run").disabled=false}
});
setBackend();
