import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readOriginalImage,imageError} from './images.js';
test('photo import keeps encoded bytes, colour profile and HDR metadata exactly unchanged',async()=>{
 const dom=new JSDOM('');try{const bytes=Uint8Array.from([255,216,255,226,...Buffer.from('ICC_PROFILE\0HDRGainMap\0hdrgm:Version=1.0'),0,12,255,217]);const file=new dom.window.File([bytes],'original.jpg',{type:'image/jpeg'});const source=await readOriginalImage(file,dom.window.FileReader);assert.deepEqual(Buffer.from(source.split(',')[1],'base64'),Buffer.from(bytes));assert.equal(imageError(file),'');}finally{dom.window.close()}
});
test('image read failures reject visibly instead of leaving insertion pending',async()=>{
 class Reader{readAsDataURL(){this.onerror()}}
 await assert.rejects(()=>readOriginalImage({},Reader),/could not be read/);
});
