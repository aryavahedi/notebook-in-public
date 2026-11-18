import {folioLabel,folioNumber} from './folio.js';
export const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
export function documentText(node){
 if(!node)return '';
 return [node.text,node.type==='figure'?node.attrs?.caption:'',node.type==='figure'?node.attrs?.alt:'',...(node.content||[]).map(documentText)].filter(Boolean).join(' ');
}
export function editedDate(entry){return entry.editedAt||entry.publication?.updatedAt||entry.createdAt||entry.originalDate||''}
export function entryState(entry,connection){
 if(entry.trashedAt)return 'In Trash';
 if(entry.publication?.status==='unpublished')return 'Unpublished';
 if(entry.publication?.status!=='published')return 'Draft';
 if(entry.dirty)return 'Unpublished changes';
 return connection?.pages?.[entry.entryId]?.currentIsLive?'Live':'Published';
}
export function firstFigure(node){
 if(node?.type==='figure'&&/^data:image\/(png|jpeg|webp|gif);base64,/.test(node.attrs?.src))return node.attrs;
 for(const child of node?.content||[]){const figure=firstFigure(child);if(figure)return figure}
}
export const firstImage=node=>firstFigure(node)?.src||'';
export function libraryEntries(entries,{query='',type='all',state='all',sort='edited',trash=false}={},connection){
 const terms=normalize(query).trim().split(/\s+/).filter(Boolean),collator=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
 return entries.filter(entry=>{
  if(entry.deletedAt)return false;
  if(Boolean(entry.trashedAt)!==trash)return false;
  if(type!=='all'&&entry.type!==type)return false;
  if(state==='draft'&&entry.publication?.status==='published')return false;
  if(state==='published'&&entry.publication?.status!=='published')return false;
  if(state==='changes'&&!(entry.publication?.status==='published'&&entry.dirty))return false;
  if(!terms.length)return true;
  const folio=folioLabel(entry),notes=Object.values(entry.body?.attrs?.annotations||{}).map(n=>(n.label||'')+' '+(n.text||''));
  const text=normalize([entry.title,entry.description,entry.type,folio,folio.replace(/[^\w]/g,''),documentText(entry.body),...notes].join(' '));
  return terms.every(term=>text.includes(term));
 }).slice().sort((a,b)=>{
  if(sort==='title')return collator.compare(a.title||`Untitled ${a.type}`,b.title||`Untitled ${b.type}`)||Number(b.entryId)-Number(a.entryId);
  if(sort==='folio')return collator.compare(a.type,b.type)||(folioNumber(a)||Infinity)-(folioNumber(b)||Infinity)||Number(b.entryId)-Number(a.entryId);
  return editedDate(b).localeCompare(editedDate(a))||Number(b.entryId)-Number(a.entryId);
 });
}
