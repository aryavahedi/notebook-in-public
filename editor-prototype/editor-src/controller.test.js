import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const html=(await readFile(new URL('../index.html',import.meta.url),'utf8')).replace(/<script[\s\S]*?<\/script>/g,'');
const bundle=await readFile(new URL('../continuous-editor.js',import.meta.url),'utf8');
function entry(id='041'){return {schemaVersion:2,entryId:id,type:'Essay',title:'Original writing',description:'A draft',originalDate:'2026-11-06',paragraphs:[],notes:[],connected:[],body:{type:'doc',attrs:{annotations:{}},content:[{type:'paragraph',attrs:{blockId:'p1',annotations:[]},content:[{type:'text',text:'Writing stays here.'}]}]}}}
async function boot(seed=entry(),connection={enabled:false,pages:{}}){
 const dom=new JSDOM(html,{url:'http://localhost:4323/',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;
 w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};w.structuredClone=structuredClone;w.confirm=()=>true;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.Range.prototype.getClientRects=()=>[];w.Range.prototype.getBoundingClientRect=()=>({top:0,bottom:0,left:0,right:0,width:0,height:0});
 let book={entries:Array.isArray(seed)?seed:[seed],activeId:Array.isArray(seed)?seed[0].entryId:seed.entryId},rev=1,reject=false,retries=[],zipBook=null,saves=[];
 w.fetch=async(url,options)=>{if(url==='/api/backups')return {ok:true,json:async()=>({running:false,lastFile:null})};if(url==='/api/backups/read')return {ok:true,json:async()=>zipBook};if(url==='/api/deployment')return {ok:true,json:async()=>structuredClone(connection)};if(url==='/api/deployment/retry'){retries.push(JSON.parse(options.body));connection={...connection,job:{...connection.job,status:'deploying',message:'Deploying the saved update'}};return {ok:true,json:async()=>structuredClone(connection)}}if(!options)return {ok:true,json:async()=>({revision:rev,notebook:structuredClone(book)})};if(reject)return {ok:false,json:async()=>({error:'Conflict: another window saved'})};const p=JSON.parse(options.body);assert.equal(p.revision,rev);if(url==='/api/entries/state'){const target=book.entries.find(e=>e.entryId===p.entryId);if(p.action==='trash')target.trashedAt='2026-11-17T12:00:00Z';else if(p.action==='delete'){assert.equal(p.confirmDelete,true);target.deletedAt='2026-11-17';target.title='';target.body={type:'doc',attrs:{annotations:{}},content:[{type:'paragraph'}]}}else delete target.trashedAt;book.activeId=book.entries.find(e=>!e.trashedAt&&e.entryId===p.activeId)?.entryId||book.entries.find(e=>!e.trashedAt)?.entryId||null;return {ok:true,json:async()=>({revision:++rev,notebook:structuredClone(book)})}}saves.push(p);book=p.notebook;return {ok:true,json:async()=>({revision:++rev})}};
 w.eval(bundle);await new Promise(r=>setTimeout(r,40));
 const input=w.document.querySelector('#restore-notebook');
 return {w,dom,book:()=>book,retries,saves,reject:()=>reject=true,async restore(next,zip=false){zipBook={entries:[next],activeId:next.entryId};Object.defineProperty(input,'files',{configurable:true,value:[{name:zip?'notebook.zip':'notebook.json',text:async()=>JSON.stringify({entries:[next],activeId:next.entryId})}]});await input.onchange({target:input});await new Promise(r=>setTimeout(r,10))}};
}
test('restoring a backup replaces an open editor and saves the complete restored body',async()=>{const h=await boot();try{const restored=entry('050');restored.title='Restored notebook';await h.restore(restored);assert.equal(h.w.document.querySelector('#title').value,'Restored notebook');assert.equal(h.book().activeId,'050');assert.equal(h.w.document.querySelector('[aria-label="Writing body"]').textContent,'Writing stays here.');assert.match(h.w.document.querySelector('#save-status').textContent,/restored|Saved/)}finally{h.dom.window.close()}});
test('a failed restore retains the current notebook and editor',async()=>{const h=await boot();try{h.reject();await h.restore({...entry('050'),title:'Should not replace current'});assert.equal(h.w.document.querySelector('#title').value,'Original writing');assert.equal(h.book().activeId,'041');assert.match(h.w.document.querySelector('#toast').textContent,/Could not restore/)}finally{h.dom.window.close()}});
test('reattaching an orphaned footnote creates a numbered reference and supports undo',async()=>{const seed=entry();seed.body.attrs.annotations.f1={id:'f1',kind:'footnote',text:'Source retained'};const h=await boot(seed);try{h.w.document.querySelector('[data-reattach="f1"]').click();assert.ok(h.w.document.querySelector('#body-editor [data-footnote="f1"]'));assert.equal(h.w.document.querySelector('#body-editor [data-footnote="f1"]').dataset.number,'1');h.w.document.querySelector('[data-command=undo]').click();assert.equal(!!h.w.document.querySelector('#body-editor [data-footnote="f1"]'),false);await new Promise(r=>setTimeout(r,280));assert.ok(h.w.document.querySelector('[data-reattach="f1"]'))}finally{h.dom.window.close()}});
test('typing metadata updates status without replacing the field or moving its cursor',async()=>{const h=await boot();try{const field=h.w.document.querySelector('#title');field.focus();field.value='A continuous title';field.setSelectionRange(5,5);field.dispatchEvent(new h.w.Event('input',{bubbles:true}));assert.equal(h.w.document.querySelector('#title'),field);assert.equal(field.selectionStart,5);assert.equal(h.w.document.querySelector('.status').textContent,'DRAFT')}finally{h.dom.window.close()}});
test('retrying a frozen deployment never replaces the editor, loses the caret, or submits newer private writing',async()=>{
 const seed=entry();seed.publication={status:'published',version:4};const h=await boot(seed,{enabled:true,websiteURL:'https://example.com/',pages:{'041':{isLive:true,currentIsLive:true}},job:{id:'frozen-job',entryId:'041',status:'error',error:'Offline'}});
 try{const body=h.w.document.querySelector('[aria-label="Writing body"]'),title=h.w.document.querySelector('#title');title.focus();title.value='New private title';title.setSelectionRange(6,6);title.dispatchEvent(new h.w.Event('input',{bubbles:true}));h.w.document.querySelector('#retry-deployment').click();await new Promise(r=>setTimeout(r,20));assert.deepEqual(h.retries,[{jobId:'frozen-job'}]);assert.equal(h.w.document.querySelector('[aria-label="Writing body"]'),body);assert.equal(h.w.document.activeElement,title);assert.equal(title.selectionStart,6);assert.equal(title.value,'New private title');assert.equal(h.w.document.querySelector('.workspace').inert,false);assert.equal(h.w.document.querySelector('#publish').disabled,true);assert.equal(h.w.document.querySelector('.status').textContent,'DEPLOYING')}
 finally{h.dom.window.close()}
});

test('verified ZIP backup follows the same schema-checked restore flow as a JSON export',async()=>{const h=await boot();try{const restored=entry('051');restored.title='Restored from ZIP';await h.restore(restored,true);assert.equal(h.w.document.querySelector('#title').value,'Restored from ZIP');assert.equal(h.book().activeId,'051');assert.equal(h.w.document.querySelector('[aria-label="Writing body"]').textContent,'Writing stays here.')}finally{h.dom.window.close()}});

test('opening an unchanged notebook does not create a competing save or another disk revision',async()=>{const h=await boot();try{assert.equal(h.saves.length,0);assert.equal(h.w.document.querySelector('#save-status').textContent,'Saved to your Mac');assert.equal(h.w.document.querySelector('#title').value,'Original writing')}finally{h.dom.window.close()}});

test('the library searches body text and combines type filters without creating entries',async()=>{
 const a=entry(),b=entry('042');b.type='Sketch';b.title='A drawing';b.body.content[0].content[0].text='The rabbit at midnight';const h=await boot([a,b]);try{h.w.document.querySelector('#show-library').click();const search=h.w.document.querySelector('#library-search');search.value='rabbit';search.dispatchEvent(new h.w.Event('input'));assert.equal(h.w.document.querySelectorAll('.library-row').length,1);assert.equal(h.w.document.querySelector('.library-row').dataset.load,'042');h.w.document.querySelector('[data-library-type="Essay"]').click();assert.equal(h.w.document.querySelectorAll('.library-row').length,0);h.w.document.querySelector('#clear-library').click();assert.equal(h.w.document.querySelectorAll('.library-row').length,2);assert.equal(h.book().entries.length,2);assert.ok(h.w.document.querySelector('#new-entry').closest('.library-header'));}finally{h.dom.window.close()}
});
test('New essay is available in the writing toolbar and starts the chosen type at the title',async()=>{const h=await boot();try{h.w.document.querySelector('#quick-new-menu [data-new-entry="Essay"]').click();assert.equal(h.w.document.querySelector('#entry-type').value,'Essay');assert.equal(h.w.document.querySelector('#title').value,'');assert.equal(h.w.document.activeElement.id,'title');assert.equal(h.w.document.querySelector('#library-dialog').hasAttribute('open'),false)}finally{h.dom.window.close()}});
test('New sketch opens image insertion immediately with no library scrolling',async()=>{const h=await boot();try{h.w.document.querySelector('#quick-new-menu [data-new-entry="Sketch"]').click();assert.equal(h.w.document.querySelector('#entry-type').value,'Sketch');assert.equal(h.w.document.querySelector('#photo-dialog').hasAttribute('open'),true);assert.equal(h.w.document.querySelector('#photo-file').required,true)}finally{h.dom.window.close()}});

test('moving the last entry to Trash survives reload and restores without republishing',async()=>{
 const h=await boot();let reloaded;
 try{
  h.w.document.querySelector('#show-library').click();h.w.document.querySelector('[data-trash-entry="041"]').click();
  assert.equal(h.w.document.querySelector('#delete-entry-dialog').hasAttribute('open'),true);
  h.w.document.querySelector('#confirm-trash').click();await new Promise(r=>setTimeout(r,30));
  assert.equal(h.book().activeId,null);assert.ok(h.book().entries[0].trashedAt);assert.equal(h.w.document.querySelector('#empty-notebook').hidden,false);
  assert.equal(h.w.document.querySelector('#publish').disabled,true);assert.equal(h.w.document.querySelectorAll('.library-row').length,0);
  reloaded=await boot(h.book().entries);assert.equal(reloaded.w.document.querySelector('#empty-notebook').hidden,false);
  h.w.document.querySelector('#show-trash').click();assert.equal(h.w.document.querySelectorAll('[data-restore-entry]').length,1);
  h.w.document.querySelector('[data-restore-entry="041"]').click();await new Promise(r=>setTimeout(r,30));
  assert.equal(h.book().entries[0].trashedAt,undefined);assert.equal(h.book().entries[0].publication,undefined);
  assert.equal(h.w.document.querySelector('#title').value,'Original writing');assert.equal(h.w.document.querySelector('[aria-label="Writing body"]').textContent,'Writing stays here.');
 }finally{h.dom.window.close();reloaded?.dom.window.close()}
});
test('published entries offer Unpublish first instead of deletion',async()=>{
 const seed=entry();seed.publication={status:'published',version:1};const h=await boot(seed);
 try{h.w.document.querySelector('#show-library').click();const button=h.w.document.querySelector('[data-trash-entry="041"]');assert.equal(button.disabled,true);assert.match(button.textContent,/Unpublish first/)}finally{h.dom.window.close()}
});
test('deleting another entry retains the focused writing surface and excludes it from connections',async()=>{
 const h=await boot([entry(),{...entry('042'),title:'Mistaken draft'}]);try{
  const body=h.w.document.querySelector('[aria-label="Writing body"]');h.w.document.querySelector('#show-library').click();h.w.document.querySelector('[data-trash-entry="042"]').click();h.w.document.querySelector('#confirm-trash').click();await new Promise(r=>setTimeout(r,30));
  assert.equal(h.w.document.querySelector('[aria-label="Writing body"]'),body);assert.equal(h.book().activeId,'041');
  h.w.document.querySelector('#close-library').click();h.w.document.querySelector('#connect-idea').click();assert.doesNotMatch(h.w.document.querySelector('#idea-results').textContent,/Mistaken draft/);
 }finally{h.dom.window.close()}
});

test('Trash permanent deletion names the entry, requires its confirmation, and removes it from results',async()=>{
 const seed=entry();seed.trashedAt='2026-11-17';const h=await boot(seed);
 try{
  h.w.document.querySelector('#show-library').click();h.w.document.querySelector('#show-trash').click();
  h.w.document.querySelector('[data-delete-entry="041"]').click();
  assert.equal(h.w.document.querySelector('#delete-entry-name').textContent,'Original writing');
  assert.equal(h.w.document.querySelector('#confirm-trash').textContent,'Delete permanently');
  assert.match(h.w.document.querySelector('#delete-entry-description').textContent,/cannot restore/);
  assert.equal(h.book().entries[0].deletedAt,undefined);
  h.w.document.querySelector('[data-close="delete-entry-dialog"]').click();assert.equal(h.book().entries[0].deletedAt,undefined);
  h.w.document.querySelector('[data-delete-entry="041"]').click();h.w.document.querySelector('#confirm-trash').click();await new Promise(r=>setTimeout(r,30));
  assert.ok(h.book().entries[0].deletedAt);assert.equal(h.w.document.querySelectorAll('.library-row').length,0);assert.equal(h.w.document.querySelector('#trash-count').textContent,'0');
  assert.equal(h.w.document.querySelector('#empty-notebook').hidden,false);
 }finally{h.dom.window.close()}
});

test('repeated image previews clear their payload and do not retain earlier snapshots', async () => {
 const draft = entry();
 draft.body.content.unshift({
  type: 'figure',
  attrs: {blockId: 'photo', src: 'data:image/jpeg;base64,' + 'A'.repeat(1_000_000), alt: 'Size fixture'},
 });
 const h = await boot(draft);
 try {
  const $ = selector => h.w.document.querySelector(selector);
  h.w.sessionStorage.setItem('folio-preview-' + 'a'.repeat(32), 'X'.repeat(4_500_000));
  h.w.sessionStorage.setItem('unrelated-setting', 'keep');
  for (let i = 0; i < 8; i++) {
   $('#preview').click();
   assert.equal($('#website-preview').hidden, false);
   const url = new URL($('#website-frame').src);
   const packet = JSON.parse(h.w.sessionStorage.getItem(url.searchParams.get('preview')));
   assert.equal(packet.entry.body.content[0].attrs.src, draft.body.content[0].attrs.src);
   assert.deepEqual(packet.entries, []);
   $('#back-to-editor').click();
   assert.equal(h.w.sessionStorage.length, 1);
   assert.equal(h.w.sessionStorage.getItem('unrelated-setting'), 'keep');
  }
 } finally { h.dom.window.close(); }
});

test('Trash and Library keep separate searches and filters', async () => {
 const h = await boot([entry(), {...entry('042'), type: 'Sketch', title: 'A deleted sketch', trashedAt: '2026-11-17'}]);
 try {
  const $ = selector => h.w.document.querySelector(selector);
  const search = $('#library-search');
  const type = filter => $(`[data-library-type="${filter}"]`);
  $('#show-library').click();
  search.value = 'Original';
  search.dispatchEvent(new h.w.Event('input'));
  type('Essay').click();
  $('#show-trash').click();
  assert.equal(search.value, '');
  assert.ok($('[data-restore-entry="042"]'));
  search.value = 'No such entry';
  search.dispatchEvent(new h.w.Event('input'));
  assert.match($('#library-items').textContent, /No matching entries/);
  $('#show-trash').click();
  assert.equal(search.value, 'Original');
  assert.equal(type('Essay').getAttribute('aria-pressed'), 'true');
  $('#show-trash').click();
  assert.equal(search.value, 'No such entry');
  $('#clear-library').click();
  assert.ok($('[data-restore-entry="042"]'));
 } finally { h.dom.window.close(); }
});
