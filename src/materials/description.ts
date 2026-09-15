import type {Job} from '../jobber/data';
export function workDescription(job:Pick<Job,'lineItems'|'quote'>|null):string|undefined {
 if(!job)return undefined;
 const jobLines=job.lineItems.nodes;
 const quoteLines=job.quote?.lineItems.nodes.filter(line=>line.optional!==true)??[];
 const described=(lines:typeof jobLines,pattern:RegExp)=>lines.filter(line=>pattern.test(line.name??'')&&line.description?.trim()).map(line=>line.description!.trim());
 const labor=described(jobLines,/\blabou?r\b/i);
 const quoteLabor=described(quoteLines,/\blabou?r\b/i);
 const intro=described(jobLines,/\bintro(?:duction)?\b/i);
 const quoteIntro=described(quoteLines,/\bintro(?:duction)?\b/i);
 const selected=[labor,quoteLabor,intro,quoteIntro].find(values=>values.length);
 return selected?[...new Set(selected)].join(' · '):job.quote?.message?.trim()||undefined;
}
