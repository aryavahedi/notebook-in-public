"""Published-only projection shared by local website serving and static export."""
from copy import deepcopy
from datetime import datetime, timezone
import json, hashlib

def now():
 return datetime.now(timezone.utc).isoformat(timespec='seconds')

def valid_number(value):
 return isinstance(value,int) and not isinstance(value,bool) and value>0

def next_folio(book,type):
 numbers=[]
 for entry in book['entries']:
  number=entry.get('folioNumbers',{}).get(type)
  if valid_number(number):numbers.append(number)
  snapshot=entry.get('published') or {}
  if snapshot.get('type')==type and valid_number(snapshot.get('folioNumber')):numbers.append(snapshot['folioNumber'])
 return max(numbers,default=0)+1

def migrate_folios(book):
 """One-time display-number migration; stable entry IDs and content are unchanged."""
 updated=deepcopy(book)
 eligible=[e for e in updated['entries'] if e.get('publication') and e.get('published')]
 eligible.sort(key=lambda e:(e['publication'].get('publishedAt',''),int(e['entryId'])))
 for entry in eligible:
  snapshot=entry['published'];type=snapshot['type'];assignments=entry.setdefault('folioNumbers',{})
  number=assignments.get(type)
  if not valid_number(number):
   candidate=snapshot.get('folioNumber')
   number=candidate if valid_number(candidate) else next_folio(updated,type)
   assignments[type]=number
  snapshot['folioNumber']=number
  entry['folioNumber']=number;entry['folioType']=type
 return updated,updated!=book

def public_snapshot(entry):
 if entry.get('schemaVersion')!=2 or not isinstance(entry.get('body'),dict):raise ValueError('Open and save this entry in the current editor first.')
 if not entry.get('title','').strip():raise ValueError('Add a title before publishing.')
 if entry.get('type') not in ('Essay','Note','Sketch'):raise ValueError('Choose Essay, Note, or Sketch.')
 result={k:deepcopy(entry.get(k)) for k in ('schemaVersion','entryId','title','description','type','originalDate','body','connected')}
 result['description']=result['description'] or '';result['connected']=result['connected'] or []
 attached=set()
 def walk(node):
  attrs=node.get('attrs',{})
  attached.update(attrs.get('annotations',[]) if isinstance(attrs.get('annotations'),list) else [])
  if node.get('type')=='footnote':attached.add(attrs.get('id'))
  attached.update(m.get('attrs',{}).get('id') for m in node.get('marks',[]) if m.get('type')=='annotation')
  for child in node.get('content',[]):walk(child)
 walk(result['body'])
 records=result['body'].setdefault('attrs',{}).get('annotations',{})
 result['body']['attrs']['annotations']={k:v for k,v in records.items() if k in attached}
 return result

def content_hash(snapshot):
 return hashlib.sha256(json.dumps({k:v for k,v in snapshot.items() if k!='publication'},sort_keys=True).encode()).hexdigest()

def publish_entry(book,entry_id,action='publish',at=None):
 """Return a new notebook; never mutate the caller's pending draft."""
 book=deepcopy(book);entry=next((e for e in book['entries'] if e['entryId']==entry_id),None)
 if entry is None:raise ValueError('Entry not found.')
 previous=entry.get('publication') or {};at=at or now();events=deepcopy(previous.get('events',[]))
 if action=='unpublish':
  if previous.get('status')!='published':raise ValueError('This entry is not published.')
  events.append({'kind':'unpublish','at':at,'version':previous.get('version',1)})
  entry['publication']={**previous,'status':'unpublished','events':events};entry['dirty']=True
 elif action=='publish':
  snapshot=public_snapshot(entry)
  assignments=entry.setdefault('folioNumbers',{});number=assignments.get(entry['type'])
  if not valid_number(number):number=next_folio(book,entry['type']);assignments[entry['type']]=number
  entry['folioNumber']=number;entry['folioType']=entry['type'];snapshot['folioNumber']=number
  if previous.get('status')=='published' and content_hash(snapshot)==content_hash(entry.get('published',{})):
   return book,entry,False
  version=previous.get('version',0)+1
  kind='publish' if version==1 else 'republish' if previous.get('status')=='unpublished' else 'update'
  events.append({'kind':kind,'at':at,'version':version})
  publication={'status':'published','version':version,'publishedAt':previous.get('publishedAt') or at,'updatedAt':at,'events':events}
  snapshot['publication']=deepcopy(publication);entry['published']=snapshot;entry['publication']=publication;entry['dirty']=False
 else:raise ValueError('Unknown publication action.')
 return book,entry,True

def catalogue(book):
 entries=[deepcopy(e['published']) for e in book.get('entries',[]) if e.get('publication',{}).get('status')=='published' and e.get('published')]
 ids={e['entryId'] for e in entries}
 for e in entries:e['connected']=[i for i in e.get('connected',[]) if i in ids and i!=e['entryId']]
 entries.sort(key=lambda e:(e.get('originalDate') or '',e['entryId']),reverse=True)
 return {'schemaVersion':1,'entries':entries}
