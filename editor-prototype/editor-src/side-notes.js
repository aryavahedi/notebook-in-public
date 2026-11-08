import {esc} from './document.js';

function letter(index){let label='';for(index++;index;index=Math.floor((index-1)/26))label=String.fromCharCode(97+(index-1)%26)+label;return label}

// Reader-only decoration. Stable annotation records and the saved document stay unchanged.
export function decorateSideNotes(holder,records){
 const notes=new Map();
 for(const el of holder.querySelectorAll('[data-annotation],[data-block-annotations]')){
  const ids=[...(el.getAttribute('data-block-annotations')||'').split(' '),el.dataset.annotation].filter(Boolean);
  for(const id of ids){if(records[id]?.kind!=='side')continue;if(!notes.has(id))notes.set(id,{...records[id],letter:letter(notes.size),ranges:[],blocks:[]});const note=notes.get(id);(el.dataset.annotation===id?note.ranges:note.blocks).push(el)}
 }
 for(const note of notes.values()){
  const label=note.letter,scope=note.ranges.length?'passage':'paragraph';note.scope=scope;
  for(const range of note.ranges){range.classList.add('side-note-anchor');range.dataset.sideAnchor=label}
  if(!note.ranges.length)for(const block of note.blocks){block.classList.add('side-note-block');block.dataset.sideBlock=[block.dataset.sideBlock,label].filter(Boolean).join(' ')}
  const marker=document.createElement('button');marker.type='button';marker.className='side-note-ref';marker.dataset.sideRef=label;marker.textContent=label;
  marker.setAttribute('aria-label',`Read side note ${label}${scope==='paragraph'?' for this paragraph':''}${note.showLabel!==false&&note.label?': '+note.label:''}`);
  marker.setAttribute('aria-controls',`side-margin-${label} side-inline-${label}`);
  if(note.ranges.length)note.ranges.at(-1).after(marker);
  else{const block=note.blocks[0];const target=block.matches('p,h1,h2,h3,pre')?block:block.querySelector('p,figcaption')||block;target.append(marker)}
 }
 return notes;
}

export function sideNoteHTML(note,mobile=false){
 const label=note.letter,heading=note.showLabel===false?'':esc(note.label??'In the margin');
 if(mobile)return `<details class="inline-note linked-side-note" id="side-inline-${label}" data-side-note="${label}"><summary><span class="side-note-letter" aria-hidden="true">${label}</span>${heading||'Side note'}</summary>${note.scope==='paragraph'?'<span class="side-note-scope">Whole paragraph</span>':''}<p>${esc(note.text)}</p><button type="button" class="side-note-return" data-side-back="${label}">Return to passage <span aria-hidden="true">↩</span></button></details>`;
 return `<div class="preview-margin-entry linked-side-note" id="side-margin-${label}" data-side-note="${label}"><div class="side-note-heading"><button type="button" class="side-note-letter" data-side-back="${label}" aria-label="Return to passage for side note ${label}">${label}</button>${heading?`<span class="eyebrow">${heading}</span>`:''}</div>${note.scope==='paragraph'?'<span class="side-note-scope">Whole paragraph</span>':''}<p>${esc(note.text)}</p></div>`;
}

export function installSideNoteInteractions(root=document){
 const selector='[data-side-anchor],[data-side-block],[data-side-ref],[data-side-note],[data-side-back]';
 const key=el=>el?.dataset.sideAnchor||el?.dataset.sideRef||el?.dataset.sideNote||el?.dataset.sideBack||el?.dataset.sideBlock?.split(' ')[0];
 function highlight(article,label){for(const el of article.querySelectorAll(selector))el.classList.toggle('side-note-active',!!label&&[el.dataset.sideAnchor,el.dataset.sideRef,el.dataset.sideNote,el.dataset.sideBack,...(el.dataset.sideBlock||'').split(' ')].includes(label))}
 function context(target){const el=target.closest?.(selector);return {el,article:el?.closest('.structured-preview'),label:key(el)}}
 root.addEventListener('pointerover',event=>{const {article,label}=context(event.target);if(article)highlight(article,label)});
 root.addEventListener('pointerout',event=>{const {article}=context(event.target);if(article&&!article.contains(event.relatedTarget))highlight(article,article.dataset.activeSideNote);else if(article&&!event.relatedTarget?.closest?.(selector))highlight(article,article.dataset.activeSideNote)});
 root.addEventListener('focusin',event=>{const {article,label}=context(event.target);if(article)highlight(article,label)});
 root.addEventListener('focusout',event=>{const {article}=context(event.target);if(article&&!event.relatedTarget?.closest?.(selector))highlight(article,article.dataset.activeSideNote)});
 root.addEventListener('click',event=>{
  const {el,article,label}=context(event.target);if(!article)return;
  article.dataset.activeSideNote=label;highlight(article,label);
  if(event.target.closest('[data-side-back]')){article.querySelector(`[data-side-ref="${label}"]`)?.focus();return}
  if(!el.matches('[data-side-ref],[data-side-anchor]')||event.target.closest('a'))return;
  const mobile=article.querySelector(`#side-inline-${label}`),margin=article.querySelector(`#side-margin-${label}`);
  if(mobile&&getComputedStyle(mobile).display!=='none'){mobile.open=true;mobile.querySelector('summary').focus()}
  else margin?.querySelector('[data-side-back]')?.focus();
 });
 root.addEventListener('keydown',event=>{if(event.key!=='Escape')return;const article=event.target.closest?.('.structured-preview');if(article){delete article.dataset.activeSideNote;highlight(article,null)}});
}
