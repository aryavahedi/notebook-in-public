const libraryKey='living-folio-library-v1';
let notebook=[];
try{notebook=JSON.parse(localStorage.getItem(libraryKey))||[]}catch{}
state.entryId=state.entryId||'041';
if(!notebook.length)notebook=library.map(x=>({entryId:x.id,title:x.title,description:x.body,type:x.type,originalDate:'2026-10-12',paragraphs:[{id:'p1',text:x.body}],notes:[],connected:[],history:[],published:null}));
function storeEntry(){const copy=structuredClone(state);const i=notebook.findIndex(x=>x.entryId===copy.entryId);if(i<0)notebook.unshift(copy);else notebook[i]=copy;try{localStorage.setItem(libraryKey,JSON.stringify(notebook));return true}catch{storage=false;$('#save-status').textContent='Library not saved — export a copy';return false}}
const saveSingle=save;save=function(){saveSingle();storeEntry();updateLibraryLinks()};
function updateLibraryLinks(){library.splice(0,library.length,...notebook.filter(x=>x.entryId!==state.entryId).map(x=>({id:x.entryId,type:x.type,title:x.title||'Untitled',body:x.description||'A draft in your notebook.'})));renderConnected();$('.folio').textContent=prefix(state.type)+' '+state.entryId;$('#write-tab').innerHTML='Your writing <span>'+notebook.length+'</span>'}
function showLibrary(){storeEntry();$('#library-search').value='';renderLibrary();$('#library-dialog').showModal()}
function renderLibrary(){const q=$('#library-search').value.toLowerCase();$('#library-items').innerHTML=notebook.filter(x=>(x.title+' '+x.type).toLowerCase().includes(q)).map(x=>`<button class="library-row" data-open-entry="${esc(x.entryId)}"><small>${prefix(x.type)} ${esc(x.entryId)} · ${x.published?'Published demo':'Draft'}</small><strong>${esc(x.title||'Untitled')}</strong><span>${esc(x.description||'')}</span></button>`).join('')||'<p class="hint">No entries match your search.</p>'}
function loadEntry(entry){state=structuredClone(entry);active=state.paragraphs.find(x=>x.type!=='image')?.id;for(const name of ['title','description'])$('#'+name).value=state[name]||'';$('#entry-type').value=state.type;renderParagraphs();renderNotes();updateType();updateLibraryLinks();saveSingle();$('#library-dialog').close();edit();window.scrollTo(0,0);$('#title').focus()}
$('#write-tab').onclick=showLibrary;$('#library-search').oninput=renderLibrary;$('#close-library').onclick=()=>$('#library-dialog').close();
$('#library-items').onclick=e=>{const b=e.target.closest('[data-open-entry]');if(b)loadEntry(notebook.find(x=>x.entryId===b.dataset.openEntry))};
$('#new-entry').onclick=()=>{if(!storeEntry()){toast('Export your current draft before creating another entry.');return}const id=String(Math.max(41,...notebook.map(x=>Number(x.entryId)||0))+1).padStart(3,'0');loadEntry({entryId:id,title:'',description:'',type:'Note',originalDate:today(),paragraphs:[{id:uid(),text:''}],notes:[],connected:[],history:[],published:null,dirty:false});storeEntry();updateLibraryLinks();toast('New note created. Choose Essay or Sketch above the title if needed.')};
// Keep published snapshots attached to their entry.
const publishEntry=$('#confirm-publish').onclick;$('#confirm-publish').onclick=()=>{publishEntry();storeEntry()};
const jump=document.createElement('button');jump.textContent='Your writing';jump.className='mobile-library';jump.onclick=showLibrary;$('.tabs').prepend(jump);
storeEntry();updateLibraryLinks();
