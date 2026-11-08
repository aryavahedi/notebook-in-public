"""Create clearly labelled illustrative notebook entries, without touching saved writing."""
from pathlib import Path
import math, struct, zlib, base64, json, uuid
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'sample-content';OUT.mkdir(exist_ok=True)
# Code-native geometric drawing, rendered into a small self-contained PNG.
w,h=900,760;pixels=bytearray([243,242,237])*(w*h)
def dot(x,y,r=1,color=(48,75,181)):
 for yy in range(max(0,int(y)-r),min(h,int(y)+r+1)):
  for xx in range(max(0,int(x)-r),min(w,int(x)+r+1)):
   if (xx-x)**2+(yy-y)**2<=(r+.5)**2:
    p=(yy*w+xx)*3;pixels[p:p+3]=bytes(color)
def line(a,b,color=(48,75,181),radius=1):
 dx,dy=b[0]-a[0],b[1]-a[1];n=max(1,int(max(abs(dx),abs(dy))*1.3))
 for i in range(n+1):dot(a[0]+dx*i/n,a[1]+dy*i/n,radius,color)
def path(points,color=(48,75,181),radius=1):
 for a,b in zip(points,points[1:]):line(a,b,color,radius)
center=(420,346);r=230
pts=[(center[0]+(r+math.sin(t*5)*.65)*math.cos(t),center[1]+(r+math.sin(t*7)*.6)*math.sin(t)) for t in [i*math.tau/900 for i in range(901)]];path(pts)
path([(257,183),(582,185),(581,509),(255,508),(257,183)])
pale=(161,174,215);path([(257,183),(581,509)],pale);path([(255,508),(582,185)],pale)
for x in range(174,675,15):line((x,346),(x+3,346),pale,0)
for y in range(100,598,15):line((420,y),(420,y+3),pale,0)
dot(420,346,4)
path([(645,245),(756,159),(740,163)]);path([(756,159),(749,177)])
path([(170,598),(290,613),(429,620),(583,615),(643,607)],(111,132,199))
for offset in [0,24,48]:path([(704,390+offset),(726,382+offset),(750,383+offset),(768,394+offset)],radius=0)
path([(146,321),(166,319)]);path([(153,311),(155,332)])
# Small handwritten a / b forms rather than a display font.
path([(411,82),(404,91),(407,98),(416,96),(421,85),(418,99),(424,99)],radius=0)
path([(674,339),(670,363),(675,353),(682,351),(686,357),(679,365),(671,363)],radius=0)
def chunk(tag,data):return struct.pack('!I',len(data))+tag+data+struct.pack('!I',zlib.crc32(tag+data)&0xffffffff)
raw=b''.join(b'\0'+pixels[y*w*3:(y+1)*w*3] for y in range(h))
png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',w,h,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')
(OUT/'two-shapes.png').write_bytes(png)
image='data:image/png;base64,'+base64.b64encode(png).decode()
def ident():return 'sample'+uuid.uuid4().hex
def text(s,marks=None):
 node={'type':'text','text':s}
 if marks:node['marks']=marks
 return node
def paragraph(*parts,annotations=None):return {'type':'paragraph','attrs':{'blockId':ident(),'annotations':annotations or []},'content':[text(p) if isinstance(p,str) else p for p in parts]}
def heading(s,level=2):return {'type':'heading','attrs':{'blockId':ident(),'annotations':[],'level':level},'content':[text(s)]}
def note(id,kind,s,label=None):return {'id':id,'kind':kind,'text':s,'label':label or 'In the margin','showLabel':True}
def foot(id):return {'type':'footnote','attrs':{'id':id}}
def bullet(s):return {'type':'listItem','content':[paragraph(s)]}
def entry(key,title,type,description,date,body,notes=None,connected=None):return {'sampleKey':key,'sampleSet':'living-folio-overview-v1','schemaVersion':2,'type':type,'title':title,'description':description,'originalDate':date,'body':{'type':'doc','attrs':{'annotations':notes or {}},'content':body},'paragraphs':[],'notes':[],'connected':connected or [],'published':None,'dirty':False}
label=lambda:paragraph(text('Illustrative sample writing for exploring this website.',[{'type':'italic'}]))
entries=[]
entries.append(entry('notebook','The notebook as a way of thinking','Essay','On unfinished thoughts, attention, and why a notebook should be more than storage.','2026-11-06',[
 label(),
 paragraph('For a long time, I thought a notebook was somewhere to keep an idea safe. A sentence arrived; I wrote it down. A useful observation appeared; I gave it a page. The book filled slowly, and I felt that something had been accomplished.'),
 paragraph('But keeping a thought is different from working on it. When I returned to those pages, many of the sentences seemed complete only because I had stopped asking questions. The notebook had preserved the first version of an idea, including all the things I had failed to notice.',foot('source')),
 heading('Give a thought somewhere to go'),
 paragraph('I am beginning to think of a notebook as ',text('a workbench rather than a cupboard',[{'type':'annotation','attrs':{'id':'workbench'}}]),'. A place to put something unfinished where I can turn it around. A drawing can interrupt an argument. A question can remain a question for a while. Two unrelated observations can share a page without being forced into a conclusion.'),
 paragraph('The important part is the return. A page becomes interesting when the person reading it is no longer quite the person who wrote it. A week is sometimes enough. A conversation, a failed attempt, or an afternoon making something with my hands can change the meaning of an old sentence.'),
 {'type':'blockquote','attrs':{'blockId':ident(),'annotations':[]},'content':[paragraph('A good page does not only remember what I thought. It gives me a reason to think again.')]},
 heading('Keep the edges open'),
 paragraph('This changes the kind of things worth writing down. Not only conclusions, but the small instructions that might lead somewhere: look at the underside; draw the joint again; find out how the woodpecker’s tongue works.',foot('question')),
 paragraph('There is room here for an essay, a diagram, an unfinished object, and a note that turns out to be wrong. They do not need to agree yet. Their closeness may be the useful thing.',annotations=['loose']),
 paragraph('What I want from this notebook is not an archive that proves I have been thinking. I want a practice that changes what I notice when I leave the page.')
],{'source':note('source','footnote','Demonstration source note: this sample essay was written for the prototype. Replace it with your own words and sources when preparing real writing.'),'question':note('question','footnote','The companion note develops the woodpecker question as a small exercise in looking closely.'),'workbench':note('workbench','side','Leave an idea visible for a day. It may ask a better question the second time you pass it.','A small experiment'),'loose':note('loose','side','Connections can be useful before they become explanations.','A loose thread')},['woodpecker','unfinished','shapes']))
entries.append(entry('woodpecker','Describe the tongue of the woodpecker','Note','A small question, carried around for a few days. A reminder to look more closely.','2026-11-05',[
 label(),paragraph('I like a question that is small enough to carry in a pocket. Not “How does nature work?” but “What happens when this particular bird reaches into a tree?”'),
 paragraph('The smaller question asks something more useful of me. It asks me to look, sketch, read, and admit what I cannot yet explain. It gives attention a direction without promising an answer.'),
 paragraph('Today’s version of the exercise: choose one ordinary thing and describe it without reaching for a general lesson.',annotations=['practice']),
 {'type':'bulletList','attrs':{'blockId':ident(),'annotations':[]},'content':[bullet('Start with what can be seen.'),bullet('Draw the part that is difficult to describe.'),bullet('Write down the next question, not a conclusion.')]},
 paragraph('A handle. A hinge. The way a leaf joins its stem. There are enough questions within reach for a lifetime.')
],{'practice':note('practice','side','This note connects back to the essay about notebooks and forward to the sketch about two shapes.','Try this')},['notebook','shapes']))
entries.append(entry('unfinished','A place for the unfinished','Note','Some things need to stay on the workbench a little longer.','2026-11-03',[
 label(),paragraph('There is a particular relief in putting a half-made thing down without putting it away. The next step can remain a little uncertain while the work stays visible.'),
 paragraph('I used to read that uncertainty as a failure of discipline. Sometimes it is. But sometimes the unfinished part is telling me where the interesting question begins.',annotations=['waiting']),
 paragraph('The distinction may be whether I return. An unfinished thing that I keep meeting can become a conversation. An unfinished thing that I carefully hide becomes an excuse.'),
 paragraph('For now, I am leaving a small space on the desk for work that has not decided what it wants to be.')
],{'waiting':note('waiting','side','Unfinished is not the same as abandoned. The difference may be attention.','Still taking shape')},['notebook','slowly']))
entries.append(entry('slowly','On doing one thing slowly','Essay','A study in repetition, feedback, and the useful limits of a small task.','2026-11-02',[
 label(),paragraph('A small task has an advantage over a grand intention: it can answer back. Draw the same curve ten times and the tenth curve knows something the first did not. The paper makes the difference visible.'),
 paragraph('Speed can hide this conversation. I finish the gesture before I have noticed which part of it needs attention. Slowing down does not make the work meaningful by itself, but it lets the feedback arrive.'),
 heading('A modest practice'),
 {'type':'orderedList','attrs':{'blockId':ident(),'annotations':[],'start':1},'content':[bullet('Choose one gesture that takes less than a minute.'),bullet('Repeat it until a difference becomes visible.'),bullet('Change one thing, and notice what follows.')]},
 paragraph('The point is not to perform patience. The point is to make a change small enough to understand. A line that wavers, a tool that catches, a sentence that refuses to settle: each offers a particular kind of information.',annotations=['feedback']),
 {'type':'blockquote','attrs':{'blockId':ident(),'annotations':[]},'content':[paragraph('Work at a speed where you can still hear what the material is telling you.')]},
 paragraph('This is another reason to keep a notebook nearby. The page can catch the observation before I turn it into a rule. “This worked today” is often more honest than “This is how it works.”'),
 paragraph('A finished object may be the result. A more careful way of noticing may be the thing I keep.')
],{'feedback':note('feedback','side','A useful note records the conditions too: what changed, what stayed the same, and what is still uncertain.','On the bench')},['unfinished','notebook']))
entries.append(entry('shapes','A thought in two shapes','Sketch','A circle, a square, and the questions that appear where they meet.','2026-11-05',[
 label(),{'type':'figure','attrs':{'blockId':ident(),'annotations':[],'src':image,'alt':'A cobalt circle and square overlap, crossed by pale diagonals and dotted axes, with a small arrow and hand-drawn marks.','caption':'Study 01 · A thought in two shapes. Original geometric drawing made for this prototype.'}},
 paragraph('The circle offers one kind of boundary; the square offers another. Neither is more complete. The interesting part is what becomes visible when they share the same centre.',annotations=['drawing']),
 paragraph('I drew the diagonals last. They make the centre feel like an answer, although the drawing began as a question. Next time I might leave them out.'),
 paragraph('A drawing does not always need to illustrate a thought that already exists. Sometimes it is how the thought arrives.')
],{'drawing':note('drawing','side','The latest published sketch also appears in the homepage margin.','From the sketchbook')},['woodpecker','notebook']))
entries.append(entry('draft','A thought I’m not ready to finish','Note','An unpublished sample draft, visible only in the Writing Room.','2026-11-06',[
 paragraph(text('Unpublished sample draft.',[{'type':'italic'}])),paragraph('Perhaps a personal website should be allowed to change its mind. I have not worked out the next sentence yet.'),paragraph('This page is deliberately left unpublished so you can compare writing, previewing, and publishing.')
],connected=['unfinished']))
revision=paragraph('A later addition: leaving something visible is not the same as attending to it. I need a small habit of returning—a date in the diary, a question in the margin, or simply the decision to open the notebook before opening another tab.',annotations=['later'])
(OUT/'overview.json').write_text(json.dumps({'sampleSet':'living-folio-overview-v1','entries':entries,'laterAddition':revision},ensure_ascii=False,indent=2)+'\n')
print('Created six illustrative entries and the geometric sketch.')
