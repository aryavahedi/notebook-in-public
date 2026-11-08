export const prefix=type=>({Essay:'e.',Note:'n.',Sketch:'s.'})[type]||'e.';
export function folioNumber(entry){const number=entry.folioNumbers?.[entry.type]??(entry.folioType&&entry.folioType!==entry.type?null:entry.folioNumber);return Number.isSafeInteger(number)&&number>0?number:null}
export const displayNumber=number=>String(number);
export function folioLabel(entry){const number=folioNumber(entry);return `${prefix(entry.type)} ${number?displayNumber(number):'Draft'}`}
export function paragraphPrefix(entry){const number=folioNumber(entry);return number?prefix(entry.type)+displayNumber(number):null}
export function paragraphReference(entry,index){const value=paragraphPrefix(entry);return value?`${value}.${index}`:`¶${index}`}
