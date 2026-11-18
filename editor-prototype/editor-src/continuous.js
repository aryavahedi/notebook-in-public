import {folioLabel,folioNumber,paragraphPrefix} from './folio.js';
import {libraryEntries,documentText,editedDate,entryState,firstImage} from './library.js';
import {readOriginalImage,imageError} from './images.js';
import {publicationStatus,deploying} from './publication-status.js';
import {Editor,generateJSON,getSchema} from '@tiptap/core';
import {closeHistory} from '@tiptap/pm/history';
import {extensions,migrate,uid,esc,safeURL,render,numbering} from './document.js';
const $=s=>document.querySelector(s),today=()=>new Date().toLocaleDateString('en-CA'),clone=x=>structuredClone(x);
const parse=html=>generateJSON(html,extensions());
let book=[],entry,editor,revision=0,pending=false,busy=false,timer,ready=false,selection=null,editing=null,mode='side',metadataFocused=false,changeCounter=0,figurePosition=null,publicationAction='publish';
let connection=null,deploymentTimer,backupTimer,submittingPublication=false;
let selectedPhoto=null,selectedPhotoSource=null,libraryTrash=false,deleteEntryId=null,deleteEntryAction='trash',changingEntry=false;
const libraryViews = {
  library: {query: '', type: 'all', state: 'all', sort: 'edited'},
  trash: {query: '', type: 'all', state: 'all', sort: 'edited'},
};
const currentLibraryView = () => libraryViews[libraryTrash ? 'trash' : 'library'];
const previewStorageKey = 'folio-draft-preview';

const availableEntries=()=>book.filter(e=>!e.trashedAt);
function updateLibraryCounts(){
 const available=availableEntries();
 $('#write-tab').textContent=`Your writing · ${available.length}`;
 $('#workshop-count').textContent=available.filter(e=>e.type==='Project').length;
}
function updateDateField(){
 const field=$('#original-date'),project=entry.type==='Project',date=entry.originalDate||today();
 field.type=project?'month':'date';
 field.placeholder=project?'YYYY-MM':'';
 field.value=project?date.slice(0,7):date.length===7?date+'-01':date;
 $('#project-cover-hint').hidden=!project;
}
const status=t=>$('#save-status').textContent=t;
const notify=t=>{ $('#toast').textContent=t;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),4000)};
const records=()=>editor?.state.doc.attrs.annotations||{};
function transact(fn){metadataFocused=false;const tr=editor.state.tr;fn(tr);editor.view.dispatch(closeHistory(tr));editor.commands.focus()}
function putRecord(id,value,tr){tr.setDocAttribute('annotations',{...tr.doc.attrs.annotations,[id]:value})}
function currentBlock(){const $p=editor.state.selection.$from;for(let d=$p.depth;d>0;d--)if('blockId'in $p.node(d).attrs)return {node:$p.node(d),pos:$p.before(d)};return null}
function anchor(tr,id){const {from,to}=editor.state.selection;if(from!==to)tr.addMark(from,to,editor.schema.marks.annotation.create({id}));else{const b=currentBlock();if(b)tr.setNodeMarkup(b.pos,undefined,{...b.node.attrs,annotations:[...b.node.attrs.annotations,id]})}}
function markDirty(){entry.dirty=true;entry.editedAt=new Date().toISOString();renderPublication()}
function renderPublication(){
 if(!entry){$('#publish').disabled=true;$('#preview').disabled=true;$('#view-live').hidden=true;$('#retry-deployment').hidden=true;$('#deployment-message').textContent='Start a new entry or restore one from Trash.';return}const view=publicationStatus(entry,connection);
 $('.status').textContent=view.label.toUpperCase();$('.status').dataset.state=view.label;
 $('#publish').textContent=view.button;$('#publish').disabled=view.disabled||submittingPublication;
 $('#deployment-message').textContent=view.message;
 $('#view-live').hidden=!view.canView;if(view.liveURL)$('#view-live').href=view.liveURL;
 $('#retry-deployment').hidden=!view.retry;$('#retry-deployment').disabled=submittingPublication;
 $('#publication-status').textContent=view.label+(entry.publication?.version?' · version '+entry.publication.version:'');
}
async function refreshDeployment(){
 clearTimeout(deploymentTimer);
 try{const response=await fetch('/api/deployment');if(!response.ok)throw Error();connection=await response.json();}
 catch{connection={...connection,enabled:connection?.enabled??true,checkError:'Could not check the website connection. Your writing stays saved locally.'}}
 renderPublication();deploymentTimer=setTimeout(refreshDeployment,deploying(connection?.job)||connection?.checking?1500:15000);
}
$('#retry-deployment').onclick=async()=>{
 const retryJob=connection?.job?.status==='error';$('#retry-deployment').disabled=true;
 try{const response=await fetch(retryJob?'/api/deployment/retry':'/api/deployment/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(retryJob?{jobId:connection.job.id}:{})});const result=await response.json();if(!response.ok)throw Error(result.error);connection=result;renderPublication();refreshDeployment()}
 catch(error){notify(error.message||'Could not retry. Your writing is saved on this Mac.');$('#retry-deployment').disabled=false}
};
function sync(){if(!ready)return;pending=true;changeCounter++;status('Saving…');clearTimeout(timer);timer=setTimeout(flush,650)}
function capture(){if(editor&&entry)entry.body=editor.getJSON();return entry}
async function flush(){if(busy||!pending||!ready)return;capture();pending=false;busy=true;const snapshot=JSON.stringify({revision,notebook:{entries:book,activeId:entry?.entryId||null}});try{const r=await fetch('/api/notebook',{method:'PUT',headers:{'Content-Type':'application/json'},body:snapshot});const result=await r.json();if(!r.ok)throw Error(result.error||'Save failed');revision=result.revision;status(pending?'Saving…':'Saved to your Mac')}catch(e){pending=true;status('Not saved — back up or retry');notify(e.message)}finally{busy=false;if(pending&&$('#save-status').textContent==='Saving…')timer=setTimeout(flush,650)}}
function controls(){for(const b of document.querySelectorAll('[data-command]')){const c=b.dataset.command;b.setAttribute('aria-pressed',String(editor.isActive(c)));} }
function load(e){capture();clearTimeout(sidebarTimer);if(editor)editor.destroy();editor=null;entry=e;$('.workspace').classList.toggle('empty-notebook',!e);$('#editor').hidden=!e;$('#empty-notebook').hidden=!!e;$('#preview').disabled=!e;$('#export').disabled=!e;$('#selection-menu').hidden=true;updateLibraryCounts();if(!e){$('#body-editor').innerHTML='';$('.folio').textContent='';renderPublication();return}$('#title').value=e.title||'';$('#description').value=e.description||'';$('#entry-type').value=e.type||'Note';$('#body-editor').innerHTML='';editor=new Editor({element:$('#body-editor'),extensions:extensions(()=>paragraphPrefix(entry)),content:e.body,editorProps:{attributes:{role:'textbox','aria-label':'Writing body','aria-multiline':'true',spellcheck:'true'},handleClick(view,pos,event){const figure=event.target.closest('figure[data-image]');if(figure){let found;view.state.doc.descendants((n,p)=>{if(n.type.name==='figure'&&n.attrs.blockId===figure.dataset.blockId)found={n,p}});if(found){openPhoto(found);return true}}const id=event.target.closest('[data-annotation]')?.dataset.annotation||event.target.closest('[data-footnote]')?.dataset.footnote;if(id){if(records()[id]?.kind==='revision')openRevision(id);else openNote(records()[id]?.kind,id);return true}return false}},onUpdate(){markDirty();sync();scheduleSidebar()},onSelectionUpdate(){controls();selectionMenu()},onFocus(){metadataFocused=false;controls()}});let needsIDs=false;editor.state.doc.descendants(n=>{if('blockId'in n.attrs&&!n.attrs.blockId)needsIDs=true});if(needsIDs)editor.view.dispatch(editor.state.tr.setNodeMarkup(0,undefined,{...editor.state.doc.firstChild.attrs}));$('#library-dialog').close();$('.folio').textContent=folioLabel(e);$('.rail-bottom p').textContent='Your writing, taking shape.';$('.status').textContent=e.dirty?'UNPUBLISHED CHANGES':e.publication?.status==='published'?'PUBLISHED':'DRAFT';$('#publish').textContent=e.publication?.status==='published'?'Update website ↗':'Publish ↗';renderSidebar();controls();for(const name of ['title','description']){const area=$('#'+name);area.style.height='auto';area.style.height=area.scrollHeight+'px'}$('#title').focus();renderPublication();}
let sidebarTimer;function scheduleSidebar(){clearTimeout(sidebarTimer);sidebarTimer=setTimeout(renderSidebar,250)}
function attachments(){const set=new Set();editor.state.doc.descendants(n=>{for(const id of n.attrs.annotations||[])set.add(id);for(const m of n.marks)if(m.type.name==='annotation')set.add(m.attrs.id);if(n.type.name==='footnote')set.add(n.attrs.id)});return set}
function renderSidebar(){if(!entry)return;const all=records(),attached=attachments();$('#annotations').innerHTML=Object.values(all).filter(n=>n.kind!=='revision'&&attached.has(n.id)).map(n=>`<div class="annotation"><small>${n.kind==='footnote'?'FOOTNOTE':'SIDE NOTE'}</small>${n.kind==='footnote'||n.showLabel===false?'':`<strong class="note-custom-heading">${esc(n.label||'')}</strong>`}<p>${esc(n.text)}</p><button data-edit-note="${esc(n.id)}">Edit</button><button data-delete-note="${esc(n.id)}">Remove</button></div>`).join('');const detached=Object.values(all).filter(n=>!attached.has(n.id));$('#unattached').innerHTML=detached.length?`<h2>Unattached notes</h2><p class="hint">Their original passage was removed. Select a new passage to reattach.</p>`+detached.map(n=>`<p>${esc(n.text||'Dated revision')}</p><button data-reattach="${n.id}">Reattach</button><button data-delete-note="${n.id}">Delete</button>`).join(''):'';$('#revision-list').innerHTML=Object.values(all).filter(n=>n.kind==='revision').map(n=>`<div class="revision-item"><button data-edit-revision="${n.id}">${n.mode==='addition'?'Added':'Revised'} ${esc(n.date)}</button><button data-delete-note="${n.id}">Remove</button></div>`).join('')||'<p class="hint">No dated passages yet.</p>';$('#connected-list').innerHTML=(entry.connected||[]).map(id=>book.find(x=>x.entryId===id&&!x.trashedAt)).filter(Boolean).map(e=>`<div class="connected-item"><small>${esc(folioLabel(e))}</small><p>${esc(e.title||'Untitled')}</p><button data-disconnect="${e.entryId}">Remove</button></div>`).join('')||'<p class="hint">No connected ideas yet.</p>';updateDateField();$('#unpublish').hidden=entry.publication?.status!=='published';$('#publication-status').textContent=entry.publication?.status==='published'?`Published · version ${entry.publication.version}`:entry.publication?.status==='unpublished'?'Withdrawn from the website':'Not published';$('#publication-events').innerHTML=(entry.publication?.events||[]).slice().reverse().map(e=>`<p class="hint">${esc(e.kind)} · ${esc(new Date(e.at).toLocaleDateString())} · v${e.version}</p>`).join('');renderPublication()}
function remember(){selection=editor.state.selection.toJSON();$('#selection-menu').hidden=true}
function restore(){if(selection)editor.commands.setTextSelection({from:selection.anchor,to:selection.head})}
function openNote(kind='side',id=null){remember();mode=kind;editing=id;const n=records()[id];$('#note-kind').textContent=kind==='footnote'?'FOOTNOTE':'SIDE NOTE';$('#note-title').textContent=id?'Edit your note.':'Leave a thought beside the writing.';$('#note-text').value=n?.text||'';$('#side-label').value=n?.label??'In the margin';$('#show-side-label').checked=n?.showLabel!==false;$('#side-label-fields').hidden=kind==='footnote';$('#note-context').textContent=editor.state.selection.empty?'Attached to this paragraph.':'Attached to your selected passage.';$('#note-dialog').showModal();$('#note-text').focus()}
function removeNote(id){transact(tr=>{const next={...records()};delete next[id];tr.setDocAttribute('annotations',next);const removals=[];tr.doc.descendants((n,p)=>{if(n.type.name==='footnote'&&n.attrs.id===id)removals.push(p);n.marks.filter(m=>m.type.name==='annotation'&&m.attrs.id===id).forEach(m=>tr.removeMark(p,p+n.nodeSize,m));if(n.attrs.annotations?.includes(id))tr.setNodeMarkup(p,undefined,{...n.attrs,annotations:n.attrs.annotations.filter(x=>x!==id)})});removals.reverse().forEach(p=>tr.delete(p,p+1))});renderSidebar()}
function openRevision(id=null){remember();editing=id;const n=records()[id];$('#revision-mode').value=n?.mode||'mark';$('#revision-date').value=n?.date||today();$('#addition-text').value='';$('#revision-context').textContent=editor.state.selection.empty?'Applies to the current paragraph.':'Applies to the selected words.';$('#addition-fields').hidden=!!id||$('#revision-mode').value!=='addition';$('#revision-dialog').showModal()}
function selectionMenu(){const menu=$('#selection-menu');if(editor.state.selection.empty||document.querySelector('dialog[open]')){menu.hidden=true;return}const {from,to}=editor.state.selection;const a=editor.view.coordsAtPos(from),b=editor.view.coordsAtPos(to);menu.hidden=false;menu.style.left=Math.max(8,Math.min(window.innerWidth-340,(a.left+b.right)/2-160))+'px';menu.style.top=Math.max(8,a.top-48)+'px'}
function command(c){const chain=editor.chain().focus();const map={bold:'toggleBold',italic:'toggleItalic',strike:'toggleStrike',code:'toggleCode',bulletList:'toggleBulletList',orderedList:'toggleOrderedList',taskList:'toggleTaskList',blockquote:'toggleBlockquote',codeBlock:'toggleCodeBlock',horizontalRule:'setHorizontalRule'};if(c==='undo'||c==='redo'){if(metadataFocused){document.execCommand(c);return}chain[c]().run()}else if(/^h[1-3]$/.test(c))chain.toggleHeading({level:Number(c.slice(1))}).run();else if(map[c])chain[map[c]]().run();else if(c==='paragraph')chain.setParagraph().run();else if(c==='table')chain.insertTable({rows:3,cols:3,withHeaderRow:true}).run();else if(c==='deleteTable')chain.deleteTable().run();else if(['addRowAfter','addColumnAfter','deleteRow','deleteColumn'].includes(c))chain[c]().run();controls()}
function download(name,data){capture();const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function library(){capture();renderLibrary();$('#library-dialog').showModal();$('#library-search').focus()}
function renderLibrary(){
 const filters = currentLibraryView();
 const {query, type} = filters;
 const items = libraryEntries(book, {...filters, trash: libraryTrash}, connection);
 if ($('#library-search').value !== query) $('#library-search').value = query;
 $('#library-state').value = filters.state;
 $('#library-sort').value = filters.sort;
 const group=book.filter(e=>!e.deletedAt&&Boolean(e.trashedAt)===libraryTrash);
 $('#library-title').textContent=libraryTrash?'Trash':'Your notebook';$('.library-header .hint').textContent=libraryTrash?'Restore an entry or delete it permanently from this notebook.':'Find something to return to, or start a new page.';$('#show-trash').setAttribute('aria-pressed',String(libraryTrash));$('#trash-toggle-label').textContent=libraryTrash?'← Library':'Trash';$('#trash-count').hidden=libraryTrash;$('#trash-count').textContent=book.filter(e=>e.trashedAt&&!e.deletedAt).length;$('#library-state').disabled=libraryTrash;$('#library-count').textContent='';
 for(const item of document.querySelectorAll('[data-type-count]'))item.textContent=String(item.dataset.typeCount==='all'?group.length:group.filter(e=>e.type===item.dataset.typeCount).length);
 for(const button of document.querySelectorAll('[data-library-type]'))button.setAttribute('aria-pressed',String(button.dataset.libraryType===type));
 $('#library-count').textContent=items.length+' of '+group.length+(libraryTrash?' entries in Trash':' entries');
 $('#library-items').innerHTML=items.map(e=>{
  const title=e.title||'Untitled '+e.type.toLowerCase(),date=editedDate(e),state=entryState(e,connection),src=['Sketch','Project'].includes(e.type)?firstImage(e.body):'';
  let excerpt=e.description||documentText(e.body);if(query&&!((e.title+' '+e.description).toLowerCase().includes(query.toLowerCase()))){const body=documentText(e.body),at=body.toLowerCase().indexOf(query.toLowerCase());if(at>=0)excerpt=(at>40?'…':'')+body.slice(Math.max(0,at-40),at+130)}
  const blocked=e.publication?.status==='published',action=e.trashedAt?`<div class="library-entry-actions"><button class="library-entry-action" data-restore-entry="${e.entryId}" aria-label="Restore ${esc(title)}">Restore</button><button class="library-entry-action danger-text" data-delete-entry="${e.entryId}" aria-label="Delete ${esc(title)} permanently">Delete permanently</button></div>`:`<button class="library-entry-action danger-text" data-trash-entry="${e.entryId}" aria-label="Move ${esc(title)} to Trash" ${blocked?'disabled title="Unpublish this page first"':''}>${blocked?'Unpublish first':'Move to Trash'}</button>`;
  return `<div class="library-item"><button class="library-row" data-load="${e.entryId}" ${e.trashedAt?'disabled':''} ${e===entry?'aria-current="page"':''}><span class="library-folio"><small>${esc(folioLabel(e))}</small><span>${esc(e.type)}</span></span><span class="library-copy"><strong>${esc(title)}</strong><span>${esc(excerpt.slice(0,170))}</span></span>${src?`<img class="library-thumbnail" src="${esc(src)}" alt="" loading="lazy">`:''}<span class="library-metadata"><span class="library-state">${esc(state)}</span>${date?`<time datetime="${esc(date)}">${esc(new Date(date.length===10?date+'T12:00:00':date).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}))}</time>`:''}</span></button>${action}</div>`
 }).join('')||`<div class="library-empty"><h3>${libraryTrash&&!group.length?'Trash is empty.':'No matching entries.'}</h3><p>${libraryTrash&&!group.length?'Entries you move to Trash will appear here.':'Try a different search or clear the filters.'}</p></div>`;
 $('#library-items').scrollTop=0;
}
function askTrash(id,permanent=false){
 const target=book.find(e=>e.entryId===id);if(!target||target.deletedAt||(!permanent&&target.trashedAt)||(permanent&&!target.trashedAt)||target.publication?.status==='published')return;
 deleteEntryId=id;deleteEntryAction=permanent?'delete':'trash';$('#delete-entry-title').textContent=permanent?'Delete this entry permanently?':'Move this entry to Trash?';$('#delete-entry-description').textContent=permanent?'This removes its writing, photos and notes from the current notebook. You cannot restore it from Trash afterward. Previous local versions, backups and GitHub history are not erased.':'It will leave your Library. You can restore it from Trash; its writing, notes, history and number are kept. This does not erase earlier GitHub history.';$('#confirm-trash').textContent=permanent?'Delete permanently':'Move to Trash';$('#delete-entry-name').textContent=target.title||'Untitled '+target.type.toLowerCase();$('#delete-entry-error').textContent='';$('#delete-entry-dialog').showModal();
}
async function changeEntry(id,action){
 if(changingEntry)return;changingEntry=true;$('.workspace').inert=true;$('#library-dialog').inert=true;$('#confirm-trash').disabled=true;
 try{
  for(let i=0;busy&&i<100;i++)await new Promise(r=>setTimeout(r,50));
  await flush();if(pending||busy)throw Error('Wait for your writing to finish saving, then retry.');
  const active=entry?.entryId;const response=await fetch('/api/entries/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,entryId:id,action,activeId:active||null,confirmDelete:action==='delete'})});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Could not update this entry.');
  revision=result.revision;book=result.notebook.entries;
  if(active&&active===result.notebook.activeId){entry=book.find(e=>e.entryId===active);renderSidebar()}else{entry=undefined;load(book.find(e=>e.entryId===result.notebook.activeId))}
  updateLibraryCounts();$('#delete-entry-dialog').close();renderLibrary();if(!$('#library-dialog').open)$('#library-dialog').showModal();$('#show-trash').focus();status('Saved to your Mac');notify(action==='trash'?'Moved to Trash. You can restore it from the Library.':action==='delete'?'Deleted from this notebook. Earlier backups and GitHub history are unchanged.':'Restored to your Library. It has not been republished.');
 }catch(error){if(action!=='restore')$('#delete-entry-error').textContent=error.message;else notify(error.message)}
 finally{changingEntry=false;$('.workspace').inert=false;$('#library-dialog').inert=false;$('#confirm-trash').disabled=false}
}
function newEntry(type){
 libraryTrash=false;const now=new Date().toISOString();const e=migrate({entryId:String(Math.max(41,...book.map(x=>Number(x.entryId)||0))+1).padStart(3,'0'),title:'',description:'',type,createdAt:now,editedAt:now,originalDate:type==='Project'?today().slice(0,7):today(),paragraphs:[],notes:[],connected:[],published:null},parse);
 book.unshift(e);for(const menu of document.querySelectorAll('.new-entry-menu'))menu.open=false;load(e);sync();window.scrollTo({top:0});if(type==='Sketch')openPhoto();
}
function openPhoto(figure=null){
 remember();figurePosition=figure?.p??null;selectedPhoto=null;selectedPhotoSource=null;$('#photo-form').reset();$('#photo-error').textContent='';$('#photo-file').required=!figure;
 $('#photo-preview').hidden=!figure;if(figure){$('#photo-alt').value=figure.n.attrs.alt;$('#photo-caption').value=figure.n.attrs.caption;$('#photo-preview-image').src=figure.n.attrs.src}else $('#photo-preview-image').removeAttribute('src');
 $('#photo-dialog').showModal();
}
$('#photo-file').onchange=async()=>{const file=$('#photo-file').files[0];selectedPhoto=file;selectedPhotoSource=null;$('#photo-error').textContent=imageError(file);$('#photo-preview').hidden=true;if(imageError(file))return;try{const source=await readOriginalImage(file);if(selectedPhoto!==file)return;selectedPhotoSource=source;$('#photo-preview-image').src=source;$('#photo-preview').hidden=false}catch(error){$('#photo-error').textContent=error.message}};
$('#photo-dialog').addEventListener('close',()=>{selectedPhoto=null;selectedPhotoSource=null;$('#photo-preview-image').removeAttribute('src')});

function ideas(){const q=$('#idea-search').value.toLowerCase();$('#idea-results').innerHTML=book.filter(e=>!e.trashedAt&&e!==entry&&(e.title+' '+folioLabel(e)).toLowerCase().includes(q)).map(e=>`<label class="idea-option"><input type="checkbox" data-connect="${e.entryId}" ${(entry.connected||[]).includes(e.entryId)?'checked':''}> ${esc(e.title||'Untitled')} · ${esc(folioLabel(e))}</label>`).join('')}
function preview(published = false) {
 capture();
 if (!entry) return;
 const frame = $('#website-frame');
 const entryRoute = '#/entry/' + encodeURIComponent(entry.entryId);
 if (published) {
  frame.src = '/published/' + entryRoute;
  delete window.folioDraftPreview;
  $('#preview-source').textContent = 'Published website · on this Mac';
 } else {
  const entries = book.filter(other => !other.trashedAt && other.published &&
    other.publication?.status === 'published' && other.entryId !== entry.entryId)
    .map(other => other.published);
  // Photo-heavy projects may exceed browser storage quotas. The same-origin reader
  // uses this in-memory snapshot until the preview closes.
  for (let i=sessionStorage.length-1;i>=0;i--){
   const key=sessionStorage.key(i);
   if (key===previewStorageKey||/^folio-preview-[a-f0-9]{32}$/.test(key))sessionStorage.removeItem(key);
  }
  window.folioDraftPreview={entries,entry:{
   schemaVersion:entry.schemaVersion,entryId:entry.entryId,type:entry.type,
   title:entry.title,description:entry.description,originalDate:entry.originalDate,
   body:entry.body,connected:entry.connected,publication:entry.publication,
   folioNumber:entry.folioNumber,folioType:entry.folioType,folioNumbers:entry.folioNumbers,
   projectSlug:entry.projectSlug,
  }};
  frame.src = 'site/?continuous=1&preview=' + previewStorageKey + '&v=' + Date.now() + entryRoute;
  $('#preview-source').textContent = 'Draft · website preview';
 }
 $('#website-preview').hidden = false;
 $('.workspace').inert = true;
 $('#back-to-editor').focus();
}

function closePreview() {
 $('#website-preview').hidden = true;
 $('#website-frame').removeAttribute('src');
 delete window.folioDraftPreview;
 $('.workspace').inert = false;
 editor.commands.focus();
}
async function start(){try{const r=await fetch('/api/notebook');if(!r.ok)throw Error('Start the local writing server to save your notebook.');const data=await r.json();revision=data.revision;let old=data.notebook;if(!old){const entries=JSON.parse(localStorage.getItem('living-folio-library-v1')||'[]');old={entries:entries.length?entries:[window.editorContent],activeId:entries[0]?.entryId||'041'}}book=old.entries.map(e=>migrate({...e,entryId:e.entryId||'041'},parse));const needsSave=!data.notebook||JSON.stringify(book)!==JSON.stringify(old.entries);entry=undefined;ready=true;load(availableEntries().find(e=>e.entryId===old.activeId)||availableEntries()[0]);if(needsSave)sync();await flush();if(!pending&&!busy)status('Saved to your Mac');$('.prototype').textContent='LOCAL NOTEBOOK · ON YOUR MAC';$('.workspace').inert=false;refreshDeployment();refreshBackups()}catch(e){status(e.message);notify(e.message)}}
// The old prototype controllers are deliberately not loaded: this controller owns every body transaction.
$('.workspace').inert=true;
for(const name of ['title','description']){$('#'+name).onfocus=()=>{metadataFocused=true;$('#selection-menu').hidden=true};$('#'+name).oninput=e=>{entry[name]=e.target.value;markDirty();e.target.style.height='auto';e.target.style.height=e.target.scrollHeight+'px';sync()}}
$('#entry-type').onchange=e=>{entry.type=e.target.value;if(entry.type!=='Project'&&entry.originalDate?.length===7)entry.originalDate+='-01';updateDateField();updateLibraryCounts();markDirty();$('.folio').textContent=folioLabel(entry);editor.view.dispatch(editor.state.tr.setMeta('folio-number',true));sync()};
$('#original-date').onchange=e=>{
 const value=e.target.value;
 if(entry.type==='Project'&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)){updateDateField();return}
 entry.originalDate=value;markDirty();sync();
};
document.addEventListener('mousedown',e=>{if(e.target.closest('[data-command],#selection-menu'))e.preventDefault()});
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.deleteEntry)askTrash(b.dataset.deleteEntry,true);if(b.dataset.trashEntry)askTrash(b.dataset.trashEntry);if(b.dataset.restoreEntry)changeEntry(b.dataset.restoreEntry,'restore');if(b.dataset.newEntry)newEntry(b.dataset.newEntry);if(b.dataset.libraryType){currentLibraryView().type=b.dataset.libraryType;renderLibrary()}if(b.dataset.command)command(b.dataset.command);if(b.dataset.editNote)openNote(records()[b.dataset.editNote]?.kind,b.dataset.editNote);if(b.dataset.editRevision)openRevision(b.dataset.editRevision);if(b.dataset.deleteNote)removeNote(b.dataset.deleteNote);if(b.dataset.reattach){const id=b.dataset.reattach;transact(tr=>{if(records()[id]?.kind==='footnote')tr.insert(editor.state.selection.to,editor.schema.nodes.footnote.create({id}));else anchor(tr,id)});renderSidebar()}if(b.dataset.disconnect){entry.connected=entry.connected.filter(x=>x!==b.dataset.disconnect);markDirty();sync();renderSidebar()}if(b.dataset.load&&!book.find(x=>x.entryId===b.dataset.load)?.trashedAt){load(book.find(x=>x.entryId===b.dataset.load));sync()}if(b.dataset.close)$('#'+b.dataset.close).close();if(b.dataset.insert){const v=b.dataset.insert;$('#insert-menu').open=false;if(v==='side'||v==='footnote')openNote(v);else if(v==='revision')openRevision();else if(v==='image'){openPhoto()}else if(v==='markdown'){remember();$('#markdown-dialog').showModal()}else command(v)}});
$('#note-form').onsubmit=e=>{e.preventDefault();restore();const id=editing||uid(),n={...records()[id],id,kind:mode,text:$('#note-text').value,label:$('#side-label').value,showLabel:$('#show-side-label').checked};transact(tr=>{putRecord(id,n,tr);if(!editing){if(mode==='footnote')tr.insert(editor.state.selection.to,editor.schema.nodes.footnote.create({id}));else anchor(tr,id)}});$('#note-dialog').close();renderSidebar()};$('#cancel-note').onclick=()=>{$('#note-dialog').close();restore();editor.commands.focus()};$('#side-shortcut').onclick=()=>openNote('side');
$('#revision-mode').onchange=()=>$('#addition-fields').hidden=$('#revision-mode').value!=='addition';
$('#revision-form').onsubmit=e=>{e.preventDefault();restore();const id=editing||uid(),n={id,kind:'revision',mode:$('#revision-mode').value,date:$('#revision-date').value};transact(tr=>{putRecord(id,n,tr);if(!editing){if(n.mode==='addition'){const node=editor.schema.nodes.paragraph.create({blockId:uid(),annotations:[id]},$('#addition-text').value?editor.schema.text($('#addition-text').value):null);const b=currentBlock();tr.insert(b?b.pos+b.node.nodeSize:editor.state.selection.to,node)}else anchor(tr,id)}});$('#revision-dialog').close();renderSidebar()};
$('#photo-form').onsubmit=async e=>{e.preventDefault();const file=$('#photo-file').files[0];if(figurePosition!==null&&!file){const pos=figurePosition;transact(tr=>tr.setNodeMarkup(pos,undefined,{...tr.doc.nodeAt(pos).attrs,alt:$('#photo-alt').value,caption:$('#photo-caption').value}));$('#photo-dialog').close();return}if(imageError(file)){$('#photo-error').textContent=imageError(file);return}try{const src=selectedPhoto===file&&selectedPhotoSource?selectedPhotoSource:await readOriginalImage(file);restore();if(figurePosition!==null){const pos=figurePosition;transact(tr=>tr.setNodeMarkup(pos,undefined,{...tr.doc.nodeAt(pos).attrs,src,alt:$('#photo-alt').value,caption:$('#photo-caption').value}))}else editor.chain().focus().insertContent({type:'figure',attrs:{blockId:uid(),annotations:[],src,alt:$('#photo-alt').value,caption:$('#photo-caption').value}}).run();$('#photo-dialog').close()}catch(error){$('#photo-error').textContent=error.message}};

$('#add-link').onclick=()=>{remember();$('#link-url').value=editor.getAttributes('link').href||'';$('#link-label').value=editor.state.doc.textBetween(editor.state.selection.from,editor.state.selection.to,' ');$('#link-dialog').showModal()};
$('#link-form').onsubmit=e=>{e.preventDefault();const url=safeURL($('#link-url').value);if(!url){$('#link-error').textContent='Use a complete web or email address.';return}restore();if(editor.state.selection.empty)editor.chain().focus().insertContent({type:'text',text:$('#link-label').value||url,marks:[{type:'link',attrs:{href:url}}]}).run();else editor.chain().focus().setLink({href:url}).run();$('#link-dialog').close()};$('#unlink').onclick=()=>{restore();editor.chain().focus().extendMarkRange('link').unsetLink().run();$('#link-dialog').close()};
$('#paste-markdown').onclick=()=>{restore();try{editor.chain().focus().insertContent($('#markdown-text').value,{contentType:'markdown'}).run();$('#markdown-dialog').close();$('#markdown-text').value=''}catch(e){notify('Could not import this Markdown. '+e.message)}};
$('#empty-library').onclick=library;$('#show-trash').onclick=()=>{libraryTrash=!libraryTrash;renderLibrary()};$('#confirm-trash').onclick=()=>changeEntry(deleteEntryId,deleteEntryAction);
$('#write-tab').onclick=library;$('#show-library').onclick=library;
$('#show-workshop').onclick=()=>{
 libraryTrash=false;
 Object.assign(currentLibraryView(),{query:'',type:'Project',state:'all'});
 library();
};$('#library-search').oninput = event => { currentLibraryView().query = event.target.value; renderLibrary(); };
$('#library-state').onchange = event => { currentLibraryView().state = event.target.value; renderLibrary(); };
$('#library-sort').onchange = event => { currentLibraryView().sort = event.target.value; renderLibrary(); };
$('#close-library').onclick=()=>$('#library-dialog').close();$('#clear-library').onclick=()=>{Object.assign(currentLibraryView(), {query: '', type: 'all', state: 'all', sort: 'edited'});renderLibrary();$('#library-search').focus()};
if(typeof ResizeObserver!=='undefined')new ResizeObserver(items=>document.documentElement.style.setProperty('--actionbar-height',items[0].target.getBoundingClientRect().height+'px')).observe($('.actionbar'));

$('#connect-idea').onclick=()=>{$('#idea-search').value='';ideas();$('#ideas-dialog').showModal()};$('#idea-search').oninput=ideas;$('#idea-results').onchange=e=>{const id=e.target.dataset.connect;if(!id)return;entry.connected=[...new Set([...(entry.connected||[]).filter(x=>x!==id),...(e.target.checked?[id]:[])])];markDirty();sync();renderSidebar()};
$('#preview').onclick=()=>preview();$('#back-to-editor').onclick=closePreview;$('#view-published').onclick=()=>preview(true);$('#desktop-preview').onclick=()=>{$('#website-frame').classList.remove('mobile-frame');$('#desktop-preview').setAttribute('aria-pressed','true');$('#mobile-preview').setAttribute('aria-pressed','false')};$('#mobile-preview').onclick=()=>{$('#website-frame').classList.add('mobile-frame');$('#desktop-preview').setAttribute('aria-pressed','false');$('#mobile-preview').setAttribute('aria-pressed','true')};document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#website-preview').hidden)closePreview()});window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===$('#website-frame').contentWindow&&e.data==='folio-close-preview')closePreview()});
function publicationDialog(action='publish'){
 publicationAction=action;$('#publish-error').textContent='';
 const online=connection?.enabled,published=entry.publication?.status==='published';
 $('#publish-heading').textContent=action==='unpublish'?'Remove this page from the website?':published?'Publish your changes?':'Ready to publish this page?';
 $('#publish-description').textContent=online?(action==='unpublish'?'Removes this page from your live website. Your writing remains saved privately.':'Sends your published website to GitHub Pages. Your other drafts stay private.'):'Updates the published copy on this Mac. Online publishing is not connected.';
 $('#publish-detail').textContent=online?'This also syncs other pages you have already marked for publication. You can keep writing while GitHub deploys.':'Your draft stays separate until you publish an update.';
 $('#confirm-publish').textContent=action==='unpublish'?'Unpublish':online?'Publish to website':published?'Update local copy':'Publish local copy';$('#publish-dialog').showModal();
}
$('#publish').onclick=()=>publicationDialog(entry.publication?.status==='unpublished'&&connection?.pages?.[entry.entryId]?.isLive?'unpublish':'publish');$('#unpublish').onclick=()=>publicationDialog('unpublish');$('#cancel-publish').onclick=()=>$('#publish-dialog').close();
function adoptPublication(result){
 if(!result.notebook)return;
 const activeId=entry.entryId;revision=result.revision;book=result.notebook.entries;entry=book.find(e=>e.entryId===activeId);$('.folio').textContent=folioLabel(entry);editor.view.dispatch(editor.state.tr.setMeta('folio-number',true));
 if(result.deployment)connection=result.deployment;
 renderSidebar();renderPublication();status('Saved to your Mac');
}
$('#confirm-publish').onclick=async()=>{
 const button=$('#confirm-publish');button.disabled=true;submittingPublication=true;$('.workspace').inert=true;renderPublication();
 const requestId=uid();
 try{
  for(let i=0;busy&&i<100;i++)await new Promise(r=>setTimeout(r,50));
  await flush();if(pending||busy)throw Error('The current draft must finish saving before publishing. Retry after saving.');
  const response=await fetch('/api/publication',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,entryId:entry.entryId,action:publicationAction,destination:connection?.enabled?'live':'local',requestId})});
  const result=await response.json();adoptPublication(result);if(!response.ok)throw Error(result.error||'Publication failed');
  $('#publish-dialog').close();notify(connection?.enabled?'Your website update has started. You can keep writing.':result.changed?'Published copy updated on your Mac.':'This version is already published.');
  refreshDeployment();
 }catch(error){$('#publish-error').textContent=error.message}
 finally{button.disabled=false;submittingPublication=false;$('.workspace').inert=false;renderPublication()}
};

$('#export').onclick=$('#export-mobile').onclick=$('#export-page').onclick=()=>download(entry.type.toLowerCase()+'-'+(folioNumber(entry)?String(folioNumber(entry)):'draft')+'.json',capture());$('#backup-notebook').onclick=()=>download('living-folio-backup.json',{entries:book,activeId:entry?.entryId||null});$('#retry-save').onclick=()=>{pending=true;flush()};
$('#restore-notebook').onchange=async e=>{try{
 const file=e.target.files[0];if(!file)return;let data;
 if(file.name?.toLowerCase().endsWith('.zip')){const response=await fetch('/api/backups/read',{method:'POST',headers:{'Content-Type':'application/zip'},body:file});data=await response.json();if(!response.ok)throw Error(data.error||'The backup could not be read.')}else data=JSON.parse(await file.text());
 if(!Array.isArray(data.entries)||!data.entries.length)throw Error('No entries found');
 const schema=getSchema(extensions());const converted=data.entries.map(x=>{
  if(typeof x.entryId!=='string'||!/^\d+$/.test(x.entryId)||typeof x.title!=='string'||(!x.body&&!Array.isArray(x.paragraphs)))throw Error('Invalid entry');
  const converted=migrate(x,parse);schema.nodeFromJSON(converted.body).check();if(converted.published)schema.nodeFromJSON(converted.published.body).check();return converted;
 });
 if(new Set(converted.map(x=>x.entryId)).size!==converted.length)throw Error('Duplicate entry IDs');
 if(!confirm('Replace this notebook with the backup? A safety backup will be kept first, and previous disk versions remain saved.'))return;
 if(busy||pending){notify('Wait for saving to finish before restoring.');return}
 $('.workspace').inert=true;
 const activeId=converted.find(x=>!x.trashedAt&&x.entryId===data.activeId)?.entryId||converted.find(x=>!x.trashedAt)?.entryId||null;
 const response=await fetch('/api/notebook',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,notebook:{entries:converted,activeId},backupBeforeReplace:true})});
 const result=await response.json();if(!response.ok)throw Error(result.error||'Disk save failed; current notebook retained');
 revision=result.revision;book=converted;entry=undefined;load(book.find(x=>x.entryId===activeId));status('Backup restored on your Mac');notify('Notebook restored.');
 }catch(error){notify('Could not restore: '+error.message)}finally{$('.workspace').inert=false;e.target.value=''}};

function renderBackups(data){
 $('#backup-now').disabled=!!data.running;
 $('#backup-status').textContent=data.error||(data.running?'Creating and verifying your backup…':data.lastBackupAt?'Last verified backup: '+new Date(data.lastBackupAt).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'Your first backup will be created after the notebook is saved.');
 $('#download-backup').hidden=!data.lastFile;
}
async function refreshBackups(){
 clearTimeout(backupTimer);
 try{const response=await fetch('/api/backups');if(!response.ok)throw Error();const data=await response.json();renderBackups(data);backupTimer=setTimeout(refreshBackups,data.running?1500:30000)}
 catch{$('#backup-status').textContent='Could not check backups. Your writing is still saved locally.';backupTimer=setTimeout(refreshBackups,30000)}
}
$('#backup-now').onclick=async()=>{
 $('#backup-now').disabled=true;
 try{if(busy||pending){await flush();if(busy||pending)throw Error('Wait for saving to finish, then back up.')}const response=await fetch('/api/backups/create',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const data=await response.json();if(!response.ok)throw Error(data.error);renderBackups(data);refreshBackups()}
 catch(error){notify(error.message||'Could not start a backup.');$('#backup-now').disabled=false}
};
$('#open-backups').onclick=async()=>{try{const response=await fetch('/api/backups/open-folder',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!response.ok)throw Error((await response.json()).error)}catch(error){notify(error.message||'Could not open the backup folder.')}};

window.addEventListener('beforeunload',e=>{if(pending||busy){e.preventDefault();e.returnValue=''}});window.addEventListener('resize',()=>$('#selection-menu').hidden=true);window.addEventListener('scroll',()=>$('#selection-menu').hidden=true,true);
$('#jump-margins').onclick=()=>$('#note-settings').scrollIntoView({block:'start'});$('#return-writing').onclick=()=>editor.commands.focus();
start();
