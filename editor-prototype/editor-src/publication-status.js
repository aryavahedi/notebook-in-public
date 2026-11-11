export const deploying=job=>['queued','preparing','pushing','deploying'].includes(job?.status);
export function publicationStatus(entry,connection){
 const page=connection?.pages?.[entry.entryId]||{},job=connection?.job,active=deploying(job),ownJob=job?.entryId===entry.entryId;
 const local=entry.publication?.status==='published';
 let label='Draft',message='Saved privately on this Mac.',button='Publish to website ↗';
 if(entry.publication?.status==='unpublished'){label=page.isLive?'Unpublished changes':'Unpublished';message=page.isLive?'Removal is saved locally. Publish the removal to update the live website.':'This page is not on the website. Your writing is kept privately.';if(page.isLive)button='Publish removal ↗'}
 else if(local){label=page.currentIsLive&&!entry.dirty?'Live':'Unpublished changes';message=label==='Live'?`Live on your website · version ${entry.publication.version}`:page.isLive?'Your changes stay private until you publish an update.':'A published copy is saved on this Mac. Send it to the live website when ready.';button=page.isLive?'Update live website ↗':'Publish to website ↗'}
 if(active){if(ownJob)label='Deploying';message=job.message||'Updating the website. You can keep writing.';button='Website updating…'}
 if(job?.status==='error')message=job.error||job.message;
 else if(connection?.checkError&&!active)message=connection.checkError;
 else if(connection?.checking&&!connection.live)message='Checking the live website…';
 if(connection&&!connection.enabled){button=local?'Update local copy':'Publish local copy';message='Online publishing is not connected. Published copies stay on this Mac.';if(local)label=entry.dirty?'Unpublished changes':'Published locally'}
 return {label,message,button,disabled:active||!connection,canView:!!page.isLive,
  retry:job?.status==='error'?'job':connection?.checkError?'connection':null,
  liveURL:connection?.websiteURL?connection.websiteURL+'#/entry/'+encodeURIComponent(entry.entryId):null};
}
