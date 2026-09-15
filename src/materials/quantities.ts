import type { Source } from './sources';
// A length is supported only by a matching length unit, never by a wire gauge or electrical rating.
export function supportsLength(quantity:number,unit:string|null,text:string) {
 if(!unit||!/^(ft|feet|foot|linear feet|lin\.? ft|lf)$/i.test(unit.trim())) return false;
 const number=String(quantity).replace('.', '\\.');
 return new RegExp(`(?:^|[^\\d./])${number}\\s*(?:['′](?!["″])|(?:feet|foot|ft)\\b)`, 'i').test(text);
}
