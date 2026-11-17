"""Loopback-only Writing Room, versioned notebook and published-only website."""
import json, sqlite3, argparse, io, zipfile, os, hashlib, subprocess, sys
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlsplit, unquote
from publishing import catalogue, publish_entry, migrate_folios
from deployment import Deployments, signatures
from notebook_backup import NotebookBackups, read_notebook_backup
from entry_lifecycle import change_entry_state
ROOT=Path(__file__).resolve().parent
parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=4321);parser.add_argument('--data-dir',default=str(ROOT.parent/'notebook-data'));parser.add_argument('--github-repo-dir');args=parser.parse_args()
DATA=Path(args.data_dir);DATA.mkdir(parents=True,exist_ok=True);DB=DATA/'notebook.sqlite3'
backups=NotebookBackups(DB,DATA.parent/'notebook-backups')
configuration=DATA/'publishing-config.json'
if args.github_repo_dir:configuration.write_text(json.dumps({'repositoryPath':str(Path(args.github_repo_dir).resolve())}))
try:repository=json.loads(configuration.read_text()).get('repositoryPath')
except (OSError,ValueError):repository=None
deployments=Deployments(DATA,repository)
with sqlite3.connect(DB) as db:db.execute('CREATE TABLE IF NOT EXISTS versions (revision INTEGER PRIMARY KEY AUTOINCREMENT, saved_at TEXT DEFAULT CURRENT_TIMESTAMP, content TEXT NOT NULL)')
def latest(db):
 row=db.execute('SELECT revision,content FROM versions ORDER BY revision DESC LIMIT 1').fetchone()
 return (row[0],json.loads(row[1])) if row else (0,None)
# Upgrade only display metadata; previous database versions remain recoverable.
with sqlite3.connect(DB) as db:
 _,book=latest(db)
 if book:
  migrated,changed=migrate_folios(book)
  if changed:db.execute('INSERT INTO versions(content) VALUES (?)',(json.dumps(migrated),))
deployments.start()
backups.start()
def deployment_status(book):
 state=deployments.snapshot();live=(state.get('live') or {}).get('entries',{});current=signatures(catalogue(book or {'entries':[]})['entries'])
 state['pages']={e['entryId']:{'isLive':e['entryId'] in live,'currentIsLive':current.get(e['entryId'])==live[e['entryId']] if e['entryId'] in live else False} for e in (book or {}).get('entries',[])}
 return state
def public_files(book):
 """Explicit allowlist: no editor, database, backups, sources or draft payloads."""
 site=ROOT/'site';files={}
 for name in ['styles.css','theme.js','app.js','preview-content.css','preview-adapter.js']:
  files[name]=(site/name).read_bytes()
 for p in (site/'assets').rglob('*'):
  if p.is_file():files['assets/'+str(p.relative_to(site/'assets'))]=p.read_bytes()
 html=(site/'index.html').read_text().replace('data-content-source="preview"','data-content-source="published"').replace('../continuous-reader.js','continuous-reader.js')
 files['index.html']=html.encode();files['continuous-reader.js']=(ROOT/'continuous-reader.js').read_bytes()
 files['content/published.json']=json.dumps(catalogue(book or {'entries':[]}),ensure_ascii=False).encode()
 return files
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**k):super().__init__(*a,directory=str(ROOT),**k)
 def end_headers(self):self.send_header('Cache-Control','no-store');super().end_headers()
 def send_bytes(self,status,raw,kind,filename=None):
  self.send_response(status);self.send_header('Content-Type',kind);self.send_header('Content-Length',str(len(raw)))
  if filename:self.send_header('Content-Disposition',f'attachment; filename="{filename}"')
  self.end_headers();self.wfile.write(raw)
 def send_json(self,status,value):self.send_bytes(status,json.dumps(value).encode(),'application/json')
 def allowed(self):
  host=self.headers.get('Host','');origin=self.headers.get('Origin')
  return host in (f'localhost:{args.port}',f'127.0.0.1:{args.port}') and (not origin or origin==f'http://{host}')
 def read_json(self):
  length=int(self.headers.get('Content-Length',0))
  if length<1 or length>25000000:raise ValueError('Notebook exceeds 25 MB')
  return json.loads(self.rfile.read(length))
 def do_GET(self):
  if not self.allowed():return self.send_json(403,{'error':'Local access only'})
  path=unquote(urlsplit(self.path).path)
  if path=='/api/health':return self.send_json(200,{'application':'living-folio-writing-room','notebookId':hashlib.sha256(str(DB.resolve()).encode()).hexdigest()[:20],'pid':os.getpid()})
  if path=='/api/backups':return self.send_json(200,backups.status())
  if path=='/api/backups/latest':
   archive=backups.latest_path()
   if not archive:return self.send_json(404,{'error':'No verified backup is available yet.'})
   self.send_response(200);self.send_header('Content-Type','application/zip');self.send_header('Content-Length',str(archive.stat().st_size));self.send_header('Content-Disposition',f'attachment; filename="{archive.name}"');self.end_headers()
   with archive.open('rb') as source:
    for block in iter(lambda:source.read(65536),b''):self.wfile.write(block)
   return
  if path=='/api/notebook':
   with sqlite3.connect(DB) as db:revision,book=latest(db)
   return self.send_json(200,{'revision':revision,'notebook':book})
  if path=='/api/deployment':
   with sqlite3.connect(DB) as db:_,book=latest(db)
   return self.send_json(200,deployment_status(book))
  if path=='/published':
   self.send_response(302);self.send_header('Location','/published/');self.end_headers();return
  if path.startswith('/published/') or path=='/api/export-website':
   with sqlite3.connect(DB) as db:_,book=latest(db)
   files=public_files(book)
   if path=='/api/export-website':
    output=io.BytesIO()
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as z:
     for name,raw in files.items():z.writestr(name,raw)
    return self.send_bytes(200,output.getvalue(),'application/zip','living-folio-published-website.zip')
   name=path[len('/published/'):] or 'index.html'
   if name not in files:return self.send_json(404,{'error':'Page not found'})
   kind=self.guess_type(name);return self.send_bytes(200,files[name],kind)
  if path.startswith('/api/'):return self.send_json(404,{'error':'Not found'})
  super().do_GET()
 def do_PUT(self):
  if not self.allowed() or self.headers.get('Content-Type')!='application/json':return self.send_json(403,{'error':'Local JSON requests only'})
  if self.path!='/api/notebook':return self.send_json(404,{'error':'Not found'})
  try:
   payload=self.read_json();book=payload['notebook']
   if not isinstance(book,dict) or not isinstance(book.get('entries'),list) or not book['entries']:raise ValueError('Missing entries')
   ids=set()
   for entry in book['entries']:
    if not isinstance(entry.get('entryId'),str) or not entry['entryId'].isdigit() or entry['entryId'] in ids:raise ValueError('Invalid entry IDs')
    ids.add(entry['entryId'])
    if not isinstance(entry.get('title'),str) or not (isinstance(entry.get('paragraphs'),list) or (entry.get('schemaVersion')==2 and isinstance(entry.get('body'),dict) and entry['body'].get('type')=='doc')):raise ValueError('Invalid entry')
   available={e['entryId'] for e in book['entries'] if not e.get('trashedAt')}
   if book.get('activeId') not in available and not (not available and book.get('activeId') is None):raise ValueError('Invalid active entry')
   book,_=migrate_folios(book)
   if payload.get('backupBeforeReplace'):
    with sqlite3.connect(DB) as db:current,_=latest(db)
    if payload.get('revision')!=current:return self.send_json(409,{'error':'Another window saved a newer notebook. Reload before restoring.'})
    if not backups.create(force=True,reason='before-restore'):raise ValueError('A verified safety backup could not finish. Wait for any running backup, then retry restoring.')
   with sqlite3.connect(DB) as db:
    db.execute('BEGIN IMMEDIATE');revision,_=latest(db)
    if payload.get('revision')!=revision:return self.send_json(409,{'error':'Another window saved a newer version. Back up your draft before reloading.'})
    cursor=db.execute('INSERT INTO versions(content) VALUES (?)',(json.dumps(book),));new_revision=cursor.lastrowid
   if not backups.latest_path():backups.request(reason='automatic')
   return self.send_json(200,{'revision':new_revision})
  except (ValueError,KeyError,TypeError) as error:return self.send_json(400,{'error':str(error)})
  except Exception:return self.send_json(500,{'error':'Could not save to disk. Export a backup and retry.'})
 def do_POST(self):
  if self.path=='/api/backups/read':
   if not self.allowed() or self.headers.get('Content-Type')!='application/zip':return self.send_json(403,{'error':'Local backup imports only'})
   try:
    size=int(self.headers.get('Content-Length',0))
    if size<1 or size>100_000_000:raise ValueError('Choose a backup ZIP under 100 MB.')
    return self.send_json(200,read_notebook_backup(self.rfile.read(size)))
   except (ValueError,KeyError,zipfile.BadZipFile):return self.send_json(400,{'error':'This backup could not be verified. Choose another Writing Room backup ZIP.'})
  if not self.allowed() or self.headers.get('Content-Type')!='application/json':return self.send_json(403,{'error':'Local JSON requests only'})
  if self.path=='/api/entries/state':
   try:
    payload=self.read_json()
    with deployments.lock, sqlite3.connect(DB) as db:
     db.execute('BEGIN IMMEDIATE');revision,book=latest(db)
     if payload.get('revision')!=revision:return self.send_json(409,{'error':'Another window saved a newer notebook. Reload before deleting or restoring.'})
     target=next((e for e in book['entries'] if e['entryId']==payload.get('entryId')),None)
     if target is None:raise ValueError('Entry not found.')
     if payload.get('action') in ('trash','delete') and deployments.enabled and target.get('publication'):
      state=deployments.snapshot()
      if deployments.busy() or state.get('checking'):raise ValueError('Wait for the website update to finish before deleting this entry.')
      if state.get('checkError'):raise ValueError('Verify the website connection before deleting this entry. Your writing is unchanged.')
      if target['entryId'] in (state.get('live') or {}).get('entries',{}):raise ValueError('This page is still live. Finish unpublishing it before moving it to Trash.')
     updated=change_entry_state(book,payload.get('entryId'),payload.get('action'),payload.get('activeId'),payload.get('confirmDelete',False))
     if updated!=book:revision=db.execute('INSERT INTO versions(content) VALUES (?)',(json.dumps(updated),)).lastrowid
    return self.send_json(200,{'revision':revision,'notebook':updated})
   except (ValueError,KeyError,TypeError) as error:return self.send_json(400,{'error':str(error)})
   except Exception:return self.send_json(500,{'error':'Could not update this entry. Your writing is unchanged; retry.'})
  if self.path in ('/api/backups/create','/api/backups/open-folder'):
   try:
    self.read_json()
    if self.path.endswith('/create'):backups.request(force=True,reason='manual')
    elif sys.platform=='darwin':
     backups.folder.mkdir(parents=True,exist_ok=True);subprocess.Popen(['/usr/bin/open',str(backups.folder)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    else:raise ValueError('Open the notebook-backups folder beside notebook-data.')
    return self.send_json(202,backups.status())
   except (ValueError,OSError) as error:return self.send_json(400,{'error':str(error)})
  if self.path in ('/api/deployment/retry','/api/deployment/refresh'):
   try:
    payload=self.read_json()
    if self.path.endswith('/retry'):deployments.retry(payload.get('jobId'))
    else:deployments.refresh()
    with sqlite3.connect(DB) as db:_,book=latest(db)
    return self.send_json(202,deployment_status(book))
   except (ValueError,KeyError,TypeError) as error:return self.send_json(400,{'error':str(error)})
  if self.path!='/api/publication':return self.send_json(404,{'error':'Not found'})
  try:
   payload=self.read_json()
   live=payload.get('destination')=='live'
   with deployments.lock:
    if live:
     if not deployments.enabled:raise ValueError('Online publishing is not connected on this Mac.')
     previous=deployments.state.get('job') or {}
     if payload.get('requestId') and previous.get('requestId')==payload['requestId']:
      with sqlite3.connect(DB) as db:revision,book=latest(db)
      return self.send_json(200,{'revision':revision,'notebook':book,'changed':False,'deployment':deployment_status(book)})
     if deployments.busy() or deployments.state.get('checking'):return self.send_json(409,{'error':'A website update is already running. You can keep writing while it finishes.'})
    with sqlite3.connect(DB) as db:
     db.execute('BEGIN IMMEDIATE');revision,book=latest(db)
     if payload.get('revision')!=revision:return self.send_json(409,{'error':'A newer notebook version exists. Back up your draft before reloading.'})
     if not book:raise ValueError('Save your entry first.')
     updated,entry,changed=publish_entry(book,payload.get('entryId'),payload.get('action','publish'))
     files=public_files(updated)
     if updated!=book:revision=db.execute('INSERT INTO versions(content) VALUES (?)',(json.dumps(updated),)).lastrowid
    result={'revision':revision,'notebook':updated,'changed':changed,'websiteURL':'/published/'}
    if live:
     try:
      # Persist a frozen public-only export before responding. Later typing cannot enter this job.
      deployments.enqueue(files,entry['entryId'],payload.get('action','publish'))
      deployments.state['job']['requestId']=payload.get('requestId');deployments._save()
     except Exception:
      result.update(error='Your published copy is saved on this Mac, but the online update could not start. Retry publishing.')
      return self.send_json(500,result)
     result['deployment']=deployment_status(updated)
   return self.send_json(202 if live else 200,result)
  except (ValueError,KeyError,TypeError) as error:return self.send_json(400,{'error':str(error)})
  except Exception:return self.send_json(500,{'error':'Publication failed. The previous website is unchanged; retry after rebuilding the project.'})
print(f'Writing room: http://localhost:{args.port}/',flush=True)
ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
