import {activeReview} from './order-review-policy.js';
// Explicit manual checkbox review. Bind real files without inventing a page number.
export function directMatchRequest(record,item,documentId='',page=0){
 if(record.reviewCorrections?.some(c=>c.itemId===item.id&&c.status!=='Resolved'))throw Error('Resolve this revision below before marking Matched.');
 const round=activeReview(record),old=round?.answers[item.id]||round?.drafts?.[item.id];
 const eligible=(sources,exclude='',exact='')=>record.documents.filter(d=>d.bytes>0&&sources.includes(d.label)&&d.id!==exclude&&(!exact||d.id===exact)&&(d.label!=='Signed Contract'||!record.contractEvidence||record.contractEvidence.documentId===d.id));
 const choose=(sources,exclude='',exact='')=>{const docs=eligible(sources,exclude,exact);const selected=docs.find(d=>d.id===documentId);if(selected)return selected;if(docs.length===1)return docs[0];if(!docs.length)throw Error('Attach '+sources.join(' / ')+' before marking Matched.');throw Error('Open the correct '+sources.join(' / ')+' attachment, then select Matched.');};
 const reference=id=>id===documentId&&page?'Page '+page:'Manual checkbox review — '+item.label;
 if(item.optional){const source=choose(['Signed Contract']);return {action:'review-answer',itemId:item.id,state:'Not Applicable',documentId:source.id,location:reference(source.id),note:'Manually confirmed not applicable to this signed order: '+item.label,referenceMethod:'manual-checkbox',comparisons:[]};}
 const source=choose(item.sources),comparisons=(item.comparisons||[]).map(proof=>{const document=choose(proof.sources,source.id,proof.documentId);return {documentId:document.id,location:reference(document.id)};});
 return {action:'review-answer',itemId:item.id,state:'Checked',documentId:source.id,location:reference(source.id),comparisons,note:old?.note||'',referenceMethod:'manual-checkbox'};
}
