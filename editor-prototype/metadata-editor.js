// Stable text surfaces: autosaving never replaces the focused title/deck DOM.
for(const name of ['title','description']){
 const old=document.getElementById(name),field=document.createElement('div');
 field.id=name;field.className=old.className+' metadata-editor';field.contentEditable='plaintext-only';field.setAttribute('role','textbox');field.setAttribute('aria-multiline','true');field.setAttribute('aria-label',name==='title'?'Entry title':'Short description');field.spellcheck=true;field.textContent=state[name]||'';
 Object.defineProperty(field,'value',{get(){return this.innerText.replace(/\r/g,'')},set(value){const text=String(value??'');if(this.innerText!==text)this.textContent=text}});
 old.replaceWith(field);
 field.addEventListener('input',()=>{state[name]=field.value;save()});
 field.addEventListener('focus',()=>{if(typeof writingRange!=='undefined'){writingRange=null;writingNode=null}document.querySelectorAll('[data-format]').forEach(b=>b.setAttribute('aria-pressed','false'))});
}
