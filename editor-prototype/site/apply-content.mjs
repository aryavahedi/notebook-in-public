// Convert an exported page into the content file consumed by the static site.
import {readFile,writeFile} from 'node:fs/promises';
const path=process.argv[2];
if(!path)throw new Error('Provide the exported notebook-essay.json file.');
const data=JSON.parse(await readFile(path,'utf8'));
if(typeof data.title!=='string'||!Array.isArray(data.paragraphs)||!Array.isArray(data.notes))throw new Error('This is not a valid page content file.');
await writeFile(new URL('./content/notebook-essay.json',import.meta.url),JSON.stringify(data,null,2)+'\n');
await writeFile(new URL('./content/notebook-essay.js',import.meta.url),'window.editorContent='+JSON.stringify(data)+';\n');
console.log('Page content updated.');
