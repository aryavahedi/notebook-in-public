import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicationStatus} from './publication-status.js';
const entry={entryId:'049',publication:{status:'published',version:4},dirty:false};
const connection={enabled:true,websiteURL:'https://example.com/',live:{},pages:{'049':{isLive:true,currentIsLive:true}}};
test('Live requires the current snapshot to match the deployed version and no private edits',()=>{
 assert.equal(publicationStatus(entry,connection).label,'Live');
 assert.equal(publicationStatus({...entry,dirty:true},connection).label,'Unpublished changes');
 assert.equal(publicationStatus(entry,{...connection,pages:{}}).label,'Unpublished changes');
 assert.equal(publicationStatus({entryId:'050',dirty:true},connection).label,'Draft');
});
test('deployment allows writing but disables another publication and retains the previous live link',()=>{
 const result=publicationStatus({...entry,dirty:true},{...connection,job:{entryId:'049',status:'deploying',message:'Deploying'}});
 assert.equal(result.label,'Deploying');assert.equal(result.disabled,true);assert.equal(result.canView,true);
});
test('failed jobs offer an exact-update retry and preserve live page access',()=>{
 const result=publicationStatus(entry,{...connection,job:{entryId:'049',status:'error',error:'Connection lost'}});
 assert.equal(result.retry,'job');assert.equal(result.message,'Connection lost');assert.equal(result.canView,true);assert.equal(result.disabled,false);
});
test('withdrawal is pending until the page is actually absent from the deployed catalogue',()=>{
 const withdrawn={...entry,publication:{status:'unpublished',version:4}};
 assert.equal(publicationStatus(withdrawn,connection).label,'Unpublished changes');
 assert.equal(publicationStatus(withdrawn,{...connection,pages:{}}).label,'Unpublished');
});
