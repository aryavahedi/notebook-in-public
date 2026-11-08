// Interaction refinements from the full workflow review.
let removalSnapshot=null,protectRemovalSave=false;
const previousSave=save;save=function(){if(removalSnapshot){if(protectRemovalSave)protectRemovalSave=false;else clearRemoval()}previousSave()};
function rememberRemoval(){protectRemovalSave=true;removalSnapshot=structuredClone(state);$('#removal-status').hidden=false;$('#removal-status span').textContent='Removed from this draft.'}
function clearRemoval(){removalSnapshot=null;$('#removal-status').hidden=true}
function enhanceBlocks(){
 const containers=[...$('#paragraphs').children];
 containers.forEach((el,index)=>{const block=state.paragraphs[index];const controls=document.createElement('div');controls.className='block-actions';controls.innerHTML=`<button data-block-move="${esc(block.id)}" data-direction="-1" aria-label="Move ${block.type==='image'?'image':'paragraph '+paragraphNumber(block.id)} up" ${index===0?'disabled':''}>↑</button><button data-block-move="${esc(block.id)}" data-direction="1" aria-label="Move ${block.type==='image'?'image':'paragraph '+paragraphNumber(block.id)} down" ${index===state.paragraphs.length-1?'disabled':''}>↓</button>${block.type!=='image'?`<button data-block-remove="${esc(block.id)}" aria-label="Remove paragraph ${paragraphNumber(block.id)}">Remove</button>`:''}`;el.append(controls)});
 ensureTextActive();syncTarget();
}
$('#insert-target').onchange=e=>{active=e.target.value;syncTarget();document.getElementById(active)?.focus()};
$('#jump-notes').onclick=()=>{$('#note-settings').scrollIntoView({block:'start',behavior:'smooth'});$('#note-settings').focus({preventScroll:true})};
// Capture removals before their existing handlers mutate state.
document.addEventListener('click',e=>{if(e.target.closest('[data-remove],[data-delete-image],[data-block-remove]'))rememberRemoval()},true);
document.addEventListener('input',e=>{if(e.target.closest('#editor,#note-form,#photo-form'))clearRemoval()});
$('#paragraphs').addEventListener('click',e=>{
 const move=e.target.closest('[data-block-move]');
 if(move){clearRemoval();const i=state.paragraphs.findIndex(p=>p.id===move.dataset.blockMove);const destination=i+Number(move.dataset.direction);if(destination<0||destination>=state.paragraphs.length)return;const [block]=state.paragraphs.splice(i,1);state.paragraphs.splice(destination,0,block);renderParagraphs();renderNotes();save();document.getElementById(block.id)?.focus();return}
 const remove=e.target.closest('[data-block-remove]');
 if(remove){const id=remove.dataset.blockRemove;state.paragraphs=state.paragraphs.filter(p=>p.id!==id);const lost=state.notes.filter(n=>n.paragraph===id&&(n.kind==='side'||!state.paragraphs.some(p=>p.text.includes(`[${n.id.slice(1)}]`))));state.notes=state.notes.filter(n=>!lost.includes(n));if(!state.paragraphs.some(p=>p.type!=='image'))state.paragraphs.push({id:uid(),text:''});ensureTextActive();renderParagraphs();renderNotes();save();$('#undo-removal').focus()}
});
$('#undo-removal').onclick=()=>{if(!removalSnapshot)return;state=removalSnapshot;clearRemoval();renderParagraphs();renderNotes();renderConnected();save();toast('Removal undone.')};
const previousRenderNotes=renderNotes;
renderNotes=function(){previousRenderNotes();const nodes=[...$('#annotations').children];state.notes.forEach((note,i)=>{if(note.kind==='side'&&note.showLabel!==false){const heading=document.createElement('strong');heading.className='note-custom-heading';heading.textContent=note.label??'In the margin';nodes[i].insertBefore(heading,nodes[i].querySelector('p'))}if(note.kind==='footnote'&&!state.paragraphs.some(p=>p.text.includes(`[${note.id.slice(1)}]`))){const warning=document.createElement('p');warning.className='missing-reference';warning.textContent='Reference missing from the text. Remove this note or insert its reference again.';const button=document.createElement('button');button.textContent='Restore reference';button.onclick=()=>{const p=state.paragraphs.find(p=>p.id===note.paragraph&&p.type!=='image')||state.paragraphs.find(p=>p.type!=='image');if(!p)return;note.paragraph=p.id;p.text+=`[${note.id.slice(1)}]`;renderParagraphs();renderNotes();save()};nodes[i].append(warning,button)}})};
// Do not show success until the complete published snapshot is saved.
$('#confirm-publish').onclick=()=>{
 const proposed=structuredClone(state);proposed.published={title:state.title,description:state.description,type:state.type,originalDate:state.originalDate||'2026-10-12',paragraphs:structuredClone(state.paragraphs),notes:structuredClone(state.notes),connected:[...state.connected],history:structuredClone(state.history),date:new Date().toISOString()};proposed.dirty=false;
 try{localStorage.setItem(key,JSON.stringify(proposed))}catch{storage=false;$('#save-status').textContent='Not saved — export a copy';$('#publish-error').textContent='This browser could not save the demo. Export your draft to keep it, then reduce large images and try again.';return}
 state=proposed;storage=true;$('#publish-error').textContent='';$('#save-status').textContent='Demo saved on this browser';$('.status').textContent='DEMO PUBLISHED';$('#publish-dialog').close();preview('published');toast('Published demo saved in this browser.')
};
const originalShowPublish=$('#publish').onclick;
$('#publish').onclick=()=>{$('#publish-error').textContent='';originalShowPublish()};
const beforePreview=preview;
preview=function(version='draft'){if(version==='published'&&!state.published){toast('Publish a demo first to preview that version.');return}$('#view-published').disabled=version==='draft'&&!state.published;$('#view-published').title=state.published?'Compare with your last published demo':'Publish a demo to compare versions';beforePreview(version)};
$('#preview').onclick=()=>preview();
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#website-preview').hidden){e.preventDefault();$('#back-to-editor').click()}});
// Sizes must reflect loaded fonts rather than fallback font measurements.
document.fonts.ready.then(()=>document.querySelectorAll('#editor textarea').forEach(resize));
window.addEventListener('resize',()=>{if(!$('#editor').hidden)document.querySelectorAll('#editor textarea').forEach(resize)});
window.addEventListener('beforeunload',e=>{if(!storage){e.preventDefault();e.returnValue=''}});
enhanceBlocks();renderNotes();
$('#website-preview').setAttribute('role','dialog');$('#website-preview').setAttribute('aria-modal','true');
$('#website-frame').addEventListener('load',()=>{try{$('#website-frame').contentDocument.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();$('#back-to-editor').click()}})}catch{}});
