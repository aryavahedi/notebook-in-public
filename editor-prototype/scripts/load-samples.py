"""Load samples through the same save/publish API as the Writing Room."""
from pathlib import Path
import json, urllib.request, urllib.error, sqlite3, hashlib
from datetime import datetime
from copy import deepcopy
ROOT=Path(__file__).resolve().parent.parent
BASE='http://localhost:4321'
source=json.loads((ROOT/'sample-content/overview.json').read_text())
def get():
 with urllib.request.urlopen(BASE+'/api/notebook') as r:return json.load(r)
def request(path,data,method='POST'):
 req=urllib.request.Request(BASE+path,json.dumps(data).encode(),{'Content-Type':'application/json'},method=method)
 with urllib.request.urlopen(req) as r:return json.load(r)
def mutate(fn):
 for attempt in range(5):
  saved=get();book=deepcopy(saved['notebook']);fn(book)
  try:return request('/api/notebook',{'revision':saved['revision'],'notebook':book},'PUT')
  except urllib.error.HTTPError as e:
   if e.code!=409 or attempt==4:raise
 raise RuntimeError('Notebook changed repeatedly. Please retry.')
def publish(id):
 for attempt in range(5):
  saved=get()
  try:return request('/api/publication',{'revision':saved['revision'],'entryId':id,'action':'publish'})
  except urllib.error.HTTPError as e:
   if e.code!=409 or attempt==4:raise
initial=get();book=initial['notebook']
if any(e.get('sampleSet')==source['sampleSet'] for e in book['entries']):
 print('This sample set is already present. Existing samples and your edits were preserved.');raise SystemExit(0)
backup=ROOT.parent/'notebook-data/before-sample-content.sqlite3'
with sqlite3.connect((ROOT.parent/'notebook-data/notebook.sqlite3').as_uri()+'?mode=ro',uri=True) as original:
 with sqlite3.connect(backup) as saved:original.backup(saved)
(ROOT.parent/'notebook-data/before-sample-content.json').write_text(json.dumps(book,ensure_ascii=False,indent=2)+'\n')
originals={e['entryId']:deepcopy(e) for e in book['entries']}
start=max(int(e['entryId']) for e in book['entries'])+1
ids={e['sampleKey']:str(start+i).zfill(3) for i,e in enumerate(source['entries'])}
samples=[]
for raw in source['entries']:
 e=deepcopy(raw);e['entryId']=ids[e['sampleKey']];e['connected']=[ids[k] for k in e['connected']];samples.append(e)
def insert(book):
 if any(e['entryId'] in ids.values() for e in book['entries']):raise RuntimeError('An entry ID was taken while preparing samples. Please retry.')
 book['entries'].extend(samples);book['activeId']=ids['notebook']
mutate(insert)
for e in samples:
 if e['sampleKey']!='draft':publish(e['entryId'])
def add_revision(book):
 e=next(e for e in book['entries'] if e['entryId']==ids['notebook'])
 e['body']['attrs']['annotations']['later']={'id':'later','kind':'revision','mode':'addition','date':datetime.now().astimezone().date().isoformat()}
 e['body']['content'].insert(-1,deepcopy(source['laterAddition']));e['dirty']=True
mutate(add_revision);publish(ids['notebook'])
final=get()['notebook'];unchanged=all(next(e for e in final['entries'] if e['entryId']==id)==old for id,old in originals.items())
manifest={'sampleSet':source['sampleSet'],'ids':ids,'publishedIds':[e['entryId'] for e in samples if e['sampleKey']!='draft'],'unpublishedDraftId':ids['draft'],'existingEntriesUnchanged':unchanged,'previousActiveId':book['activeId'],'backup':str(backup)}
(ROOT/'sample-content/loaded-samples.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest,indent=2))
