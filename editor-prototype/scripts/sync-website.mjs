// The public website is the design source. Rebuild its local preview without editing its assets.
import {readFile,writeFile,copyFile,cp,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const source=new URL('../../living-folio/dist/',import.meta.url),target=new URL('../site/',import.meta.url);
await mkdir(target,{recursive:true});
for(const file of ['styles.css','app.js','theme.js'])await copyFile(new URL(file,source),new URL(file,target));
await cp(new URL('assets/',source),new URL('assets/',target),{recursive:true});
const css=await readFile(new URL('styles.css',source)),js=await readFile(new URL('app.js',source));
const version=createHash('sha256').update(css).update(js).update(await readFile(new URL('preview-content.css',target))).update(await readFile(new URL('../continuous-reader.js',import.meta.url))).digest('hex').slice(0,12);
let html=await readFile(new URL('index.html',source),'utf8');
html=html.replace('<body>','<body data-content-source="preview">');
html=html.replaceAll('?v=theme-2','?v='+version).replace('</head>',`<link rel="stylesheet" href="preview-content.css?v=${version}">\n<script src="preview-adapter.js?v=${version}" defer></script>\n<script src="../continuous-reader.js?v=${version}" defer></script>\n</head>`);
await writeFile(new URL('index.html',target),html);
await writeFile(new URL('website-source.json',target),JSON.stringify({source:'living-folio/dist',stylesheetSHA256:createHash('sha256').update(css).digest('hex'),applicationSHA256:createHash('sha256').update(js).digest('hex')},null,2)+'\n');
console.log('Preview synchronized from the public website. Original CSS, JavaScript, fonts and theme copied unchanged.');
