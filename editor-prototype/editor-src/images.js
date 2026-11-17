export function imageError(file){
 return !file||file.size>2097152||!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)?'Choose a PNG, JPEG, WebP, or GIF up to 2 MB.':'';
}
// Keep original encoded bytes, including ICC profiles and HDR metadata. Only CSS limits display luminance.
export function readOriginalImage(file,Reader=globalThis.FileReader){
 return new Promise((resolve,reject)=>{const reader=new Reader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('The image could not be read. Try choosing it again.'));reader.readAsDataURL(file)});
}
