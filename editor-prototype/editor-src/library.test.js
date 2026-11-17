import {test} from 'node:test';
import assert from 'node:assert/strict';
import {libraryEntries,documentText} from './library.js';
const make=(id,type,title,text,date)=>({entryId:id,type,title,description:'',originalDate:date,body:{type:'doc',attrs:{annotations:{}},content:[{type:'paragraph',content:[{type:'text',text}]}]}});
test('library finds passages, accents, side notes, captions and compact folio numbers without indexing image bytes',()=>{
 const a=make('040','Note','A quiet page','Café and a small rabbit','2026-11-01');a.folioNumbers={Note:1};a.body.attrs.annotations.s={kind:'side',text:'A hidden question'};a.body.content.push({type:'figure',attrs:{src:'data:image/jpeg;base64,SECRETPIXELS',alt:'woodcut',caption:'A study in red'}});
 for(const query of ['cafe rabbit','hidden question','study red','n1','n. 1'])assert.equal(libraryEntries([a],{query}).length,1,query);
 assert.equal(libraryEntries([a],{query:'SECRETPIXELS'}).length,0);assert.doesNotMatch(documentText(a.body),/SECRETPIXELS/);
});
test('type and publication filters combine and the source order is preserved',()=>{
 const a=make('041','Essay','Essay','Words','2026-11-01'),b=make('042','Sketch','Sketch','Lines','2026-11-02'),c=make('043','Note','Note','Words','2026-11-03');a.publication={status:'published'};a.dirty=true;
 const list=[a,b,c];assert.deepEqual(libraryEntries(list,{type:'Sketch',state:'draft'}),[b]);assert.deepEqual(libraryEntries(list,{state:'changes'}),[a]);assert.deepEqual(libraryEntries(list,{state:'published'}),[a]);assert.deepEqual(list,[a,b,c]);
});
test('recent edits sort ahead of old publication dates and title sort is natural',()=>{
 const a=make('041','Essay','Study 10','Old','2026-10-01'),b=make('042','Note','Study 2','New','2026-11-01');a.editedAt='2026-11-17T12:00:00Z';
 assert.deepEqual(libraryEntries([b,a]),[a,b]);assert.deepEqual(libraryEntries([a,b],{sort:'title'}),[b,a]);
});

test('Trash is separate from normal search and preserves all original entries',()=>{
 const a=make('041','Note','Keep','Words','2026-11-01'),b=make('042','Sketch','Remove','Lines','2026-11-02');b.trashedAt='2026-11-17';
 assert.deepEqual(libraryEntries([a,b]),[a]);assert.deepEqual(libraryEntries([a,b],{trash:true}),[b]);assert.deepEqual(libraryEntries([a,b],{query:'Remove'}),[]);
});
