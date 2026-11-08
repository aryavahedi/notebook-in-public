import {folioLabel,paragraphReference} from './folio.js';
import {render,esc} from './document.js';
import {decorateSideNotes,sideNoteHTML,installSideNoteInteractions} from './side-notes.js';
export function makeArticle(data,catalogue){
  const records=data.body.attrs.annotations||{},prefix=e=>({Essay:'e.',Note:'n.',Sketch:'s.'})[e.type]||'e.';
  const format=d=>d?new Date(d+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'';
  const holder=document.createElement('div');holder.innerHTML=render(data.body);
  const sideLinks=decorateSideNotes(holder,records);
  let paragraphCount=0;const references=[],revisionIDs=new Set(),shownSides=new Set();
  holder.querySelectorAll('p').forEach(p=>{if(!p.closest('li,td,th,figcaption'))p.dataset.paragraphNumber=paragraphReference(data,++paragraphCount)});
  holder.querySelectorAll('[data-footnote]').forEach(el=>{const note=records[el.dataset.footnote];if(!note)return;const num=references.length+1;references.push(note);el.outerHTML=`<sup><a href="#/entry/${encodeURIComponent(data.entryId)}?at=fn-${num}" id="ref-${num}" aria-label="Read footnote ${num}">${num}</a></sup>`});
  const rows=[...holder.children].map(block=>{
   const ids=new Set();const elements=[block,...block.querySelectorAll('[data-annotation],[data-block-annotations]')];
   for(const el of elements){for(const id of (el.getAttribute('data-block-annotations')||'').split(' ').filter(Boolean))ids.add(id);if(el.dataset.annotation)ids.add(el.dataset.annotation)}
   const notes=[...ids].map(id=>records[id]).filter(Boolean),sideNotes=notes.filter(n=>n.kind==='side'&&!shownSides.has(n.id)).map(n=>sideLinks.get(n.id));
   sideNotes.forEach(n=>shownSides.add(n.id));
   const revisionNotes=notes.filter(n=>n.kind==='revision');revisionNotes.forEach(n=>revisionIDs.add(n.id));
   const no=block.tagName==='P'?block.dataset.paragraphNumber||'':'';if(no)delete block.dataset.paragraphNumber;
   block.querySelectorAll('[data-annotation]').forEach(el=>{if(records[el.dataset.annotation]?.kind==='revision'){el.classList.add('revision-range');el.title='Revised '+format(records[el.dataset.annotation].date)}});
   let content=block.outerHTML;
   if(revisionNotes.length)content=`<div class="revision-addition"><span class="revision-label">${revisionNotes.map(n=>`${n.mode==='addition'?'+ Added':'Revised'} ${esc(format(n.date))}`).join(' · ')}</span>${content}</div>`;
   content+=sideNotes.map(n=>sideNoteHTML(n,true)).join('');
   const margin=sideNotes.map(n=>sideNoteHTML(n)).join('');
   return window.FolioSite.paragraph(no,content,margin);
  }).join('');
  const dates=[...new Set([...revisionIDs].map(id=>records[id].date))].sort();
  const revisionCount=data.publication?Math.max(0,data.publication.version-1):dates.length;
 const summary=revisionCount===0?'First version.':revisionCount===1?'Revised once.':revisionCount===2?'Revised twice.':`Revised ${revisionCount} times.`;
  const words=holder.textContent.trim().split(/\s+/).length;
  const related=(data.connected||[]).map(id=>catalogue.find(e=>e.entryId===id)).filter(Boolean);
  function article(showRevisions){return `<article class="shell essay-page structured-preview">${window.FolioSite.breadcrumb()}<header class="essay-head"><aside class="essay-meta"><span class="folio">${esc(folioLabel(data))}</span><span class="eyebrow">${esc(data.type)}</span><div class="dates"><span>Written ${esc(format(data.originalDate))}</span>${data.publication?.version>1?`<span>Revised ${esc(format(data.publication.updatedAt.slice(0,10)))}</span>`:dates.length?`<span>Revised ${esc(format(dates.at(-1)))}</span>`:''}</div><p class="read-time">${Math.max(1,Math.ceil(words/220))} minute read</p></aside><div><h1 class="essay-title">${esc(data.title||'Untitled').replace(/\n/g,'<br>')}</h1><p class="essay-deck">${esc(data.description)}</p><div class="essay-tools"><span>A living page. ${summary}</span>${dates.length?`<span class="dot"></span><button class="revision-toggle" aria-pressed="${showRevisions}" data-revisions><span class="toggle-track" aria-hidden="true"></span><span>${showRevisions?'Hide':'Show'} revision marks</span></button>`:''}</div></div></header><div class="article-content ${showRevisions?'show-revisions':''}" id="essay-body">${rows}</div><div class="essay-bottom"><div class="end-mark" aria-hidden="true">∴</div>${data.publication?`<details class="revision-history"><summary>Publication history <span class="muted">${data.publication.version} ${data.publication.version===1?'version':'versions'}</span></summary><ul>${data.publication.events.map(event=>`<li><time>${esc(new Date(event.at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}))}</time><span>${({publish:'First published',update:'Updated',republish:'Republished',unpublish:'Withdrawn'})[event.kind]||'Updated'} · version ${event.version}</span></li>`).join('')}</ul></details>`:''}${references.length?`<section class="footnotes"><h2>Footnotes & sources</h2><ol>${references.map((n,i)=>`<li id="fn-${i+1}">${esc(n.text)}<a class="return-link" href="#/entry/${encodeURIComponent(data.entryId)}?at=ref-${i+1}" aria-label="Return to reference ${i+1}">↩</a></li>`).join('')}</ol></section>`:''}${revisionIDs.size?`<details class="revision-history"><summary>${data.publication?'Dated passages':'Revision history'} <span class="muted">${dates.length} ${dates.length===1?'revision':'revisions'}</span></summary><ul>${[...revisionIDs].map(id=>`<li><time>${esc(format(records[id].date))}</time><span>${records[id].mode==='addition'?'Added passage':'Revised passage'}</span></li>`).join('')}</ul></details>`:''}${related.length?`<section class="thought-thread"><h2>The thread of thought</h2><p>Ideas rarely arrive alone. Follow a connection.</p><div class="thread-chain">${related.map(e=>`<div class="thread-node"><span class="folio">${esc(folioLabel(e))}</span><div><h3><a href="#/entry/${encodeURIComponent(e.entryId)}">${esc(e.title||'Untitled')}</a></h3></div></div>`).join('')}</div></section>`:''}</div><nav class="essay-pagination" aria-label="Continue reading">${related.length?`<a href="#/entry/${encodeURIComponent(related[0].entryId)}"><span class="folio">${esc(folioLabel(related[0]))}</span><span class="eyebrow muted">A related ${esc(related[0].type.toLowerCase())}</span><h3>${esc(related[0].title)}</h3><span class="arrow-link blue">Follow this thought <span aria-hidden="true">→</span></span></a>`:''}<a class="arrow-link" href="#/writing">The index <span aria-hidden="true">↗</span></a></nav></article>`}

 return article;
}

export function catalogueRow(e,featured=false){
 const date=e.date?new Date(e.date+'T12:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'';
 const changed=e.publication?.version>1?new Date(e.publication.updatedAt).toLocaleDateString('en-GB',{day:'numeric',month:'short'}):null;
 return `<article class="writing-row ${featured?'featured':''}"><div class="entry-meta"><span class="folio">${esc(folioLabel(e))}</span><span class="eyebrow">${esc(e.type)}</span></div><div class="entry-copy"><a href="#${esc(e.route)}"><h3>${esc(e.title||'Untitled')}<span class="row-arrow" aria-hidden="true">↗</span></h3></a><p>${esc(e.description)}</p></div><div class="entry-date"><time datetime="${esc(e.date)}">${esc(date.toUpperCase())}</time>${changed?`<span class="revision-dot">↳ revised ${esc(changed)}</span>`:''}</div></article>`;
}
export function homepageSketch(entry){
 if(!entry)return '';
 let figure;function find(n){if(n.type==='figure'&&!figure)figure=n;for(const child of n.content||[])find(child)}find(entry.body);
 if(!figure||!/^data:image\/(png|jpeg|webp|gif);base64,/.test(figure.attrs.src))return '';
 return `<span class="sketch-kicker eyebrow">Latest sketch</span><a href="#/entry/${encodeURIComponent(entry.entryId)}"><img class="published-sketch-image" src="${esc(figure.attrs.src)}" alt="${esc(figure.attrs.alt)}"></a><figcaption><span>${esc(folioLabel(entry))}</span>${esc(figure.attrs.caption||entry.title)}</figcaption>`;
}
async function initialize(){
 const mode=document.body?.dataset.contentSource;if(!mode)return;
 try{
  let items,packet;
  if(mode==='published'){
   const response=await fetch('content/published.json',{cache:'no-store'});if(!response.ok)throw Error('The published notebook could not be loaded.');items=(await response.json()).entries;
  }else{
   const key=new URLSearchParams(location.search).get('preview');packet=JSON.parse((key?sessionStorage.getItem(key):localStorage.getItem('folio-preview-v2'))||'null');
   if(!packet)throw Error('Open a preview from the Writing Room.');items=packet.entries;
   if(packet.entry&&!items.some(e=>e.entryId===packet.entry.entryId))items.unshift(packet.entry);
  }
  items=items.filter(e=>/^\d+$/.test(e.entryId)&&e.schemaVersion===2&&e.body);
  items.sort((a,b)=>(b.originalDate||'').localeCompare(a.originalDate||'')||Number(b.entryId)-Number(a.entryId));
  const cache=new Map();
  window.FolioSite.installCatalogue(items,(data,show)=>{if(!cache.has(data.entryId))cache.set(data.entryId,makeArticle(data,items));return cache.get(data.entryId)(show)},catalogueRow,homepageSketch);
 }catch(error){document.querySelector('main').innerHTML=`<section class="shell index-head"><div><h1>The notebook is unavailable.</h1><p>${esc(error.message)}</p></div></section>`}
 document.addEventListener('keydown',e=>{if(e.key==='Escape')parent.postMessage('folio-close-preview',location.origin)});
}
installSideNoteInteractions();
initialize();
