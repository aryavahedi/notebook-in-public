let previewVersion='draft';
preview=function(version='draft'){
 previewVersion=version;
 try{localStorage.setItem(key,JSON.stringify(state))}catch{toast('Preview cannot read your latest draft because browser storage is full. Export a copy first.');return}
 if(version==='published'&&!state.published){toast('Publish a demo first to preview that version.');return}
 $('#preview-source').textContent=version==='published'?'Published demo · this browser':'Draft · website preview';
 $('#website-frame').src='site/?source='+version+'&v='+Date.now()+'#/essay/the-notebook';
 $('.workspace').inert=true;$('body>header').inert=true;$('#website-preview').hidden=false;document.body.style.overflow='hidden';$('#back-to-editor').focus();
};
$('#preview').onclick=()=>preview();
$('#back-to-editor').onclick=()=>{$('.workspace').inert=false;$('body>header').inert=false;$('#website-preview').hidden=true;document.body.style.overflow='';edit();$('#preview').focus()};
for(const mode of ['desktop','mobile'])$('#'+mode+'-preview').onclick=()=>{$('#website-frame').classList.toggle('mobile-frame',mode==='mobile');$('#desktop-preview').setAttribute('aria-pressed',mode==='desktop');$('#mobile-preview').setAttribute('aria-pressed',mode==='mobile')};
$('#view-published').onclick=()=>preview(previewVersion==='published'?'draft':'published');
$('#website-frame').addEventListener('load',()=>{$('#view-published').textContent=previewVersion==='published'?'Current draft':'Published demo'});
const originalPublish=$('#confirm-publish').onclick;
$('#confirm-publish').onclick=()=>{originalPublish();if(state.published){state.published.originalDate=state.originalDate||'2026-10-12';try{localStorage.setItem(key,JSON.stringify(state))}catch{}preview('published')}};

$('#export-page').onclick=()=>{const content={schemaVersion:1,type:state.type,title:state.title,description:state.description,originalDate:state.originalDate||'2026-10-12',paragraphs:state.paragraphs,notes:state.notes,connected:state.connected,history:state.history};const url=URL.createObjectURL(new Blob([JSON.stringify(content,null,2)+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='notebook-essay.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Page content exported with its images, notes, and revisions.')};
