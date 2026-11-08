"""Loopback-only Writing Room, versioned notebook and published-only website."""
import json, sqlite3, argparse, io, zipfile
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlsplit, unquote
from publishing import catalogue, publish_entry, migrate_folios
ROOT=Path(__file__).resolve().parent
parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=4322);parser.add_argument('--data-dir',default=str(ROOT.parent/'notebook-data'));args=parser.parse_args()
DATA=Path(args.data_dir);DATA.mkdir(parents=True,exist_ok=True);DB=DATA/'notebook.sqlite3'
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
  if path=='/api/notebook':
   with sqlite3.connect(DB) as db:revision,book=latest(db)
   return self.send_json(200,{'revision':revision,'notebook':book})
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
   if book.get('activeId') not in ids:raise ValueError('Invalid active entry')
   book,_=migrate_folios(book)
   with sqlite3.connect(DB) as db:
    db.execute('BEGIN IMMEDIATE');revision,_=latest(db)
    if payload.get('revision')!=revision:return self.send_json(409,{'error':'Another window saved a newer version. Back up your draft before reloading.'})
    cursor=db.execute('INSERT INTO versions(content) VALUES (?)',(json.dumps(book),));new_revision=cursor.lastrowid
   return self.send_json(200,{'revision':new_revision})
  except (ValueError,KeyError,TypeError) as error:return self.send_json(400,{'error':str(error)})
  except Exception:return self.send_json(500,{'error':'Could not save to disk. Export a backup and retry.'})
 def do_POST(self):
  if not self.allowed() or self.headers.get('Content-Type')!='application/json':return self.send_json(403,{'error':'Local JSON requests only'})
  if self.path!='/api/publication':return self.send_json(404,{'error':'Not found'})
  try:
   payload=self.read_json()
   with sqlite3.connect(DB) as db:
    db.execute('BEGIN IMMEDIATE');revision,book=latest(db)
    if payload.get('revision')!=revision:return self.send_json(409,{'error':'A newer notebook version exists. Back up your draft before reloading.'})
    if not book:raise ValueError('Save your entry first.')
    updated,entry,changed=publish_entry(book,payload.get('entryId'),payload.get('action','publish'))
    # Prepare the exact same published-only projection used by export before committing.
    public_files(updated)
    if changed:revision=db.execute('INSERT INTO versions(content) VALUES (?)',(json.dumps(updated),)).lastrowid
   return self.send_json(200,{'revision':revision,'notebook':updated,'changed':changed,'websiteURL':'/published/'})
  except (ValueError,KeyError,TypeError) as error:return self.send_json(400,{'error':str(error)})
  except Exception:return self.send_json(500,{'error':'Publication failed. The previous website is unchanged; retry after rebuilding the project.'})
print(f'Writing room: http://localhost:{args.port}/',flush=True)
ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
