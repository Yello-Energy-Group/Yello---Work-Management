import {randomUUID} from 'node:crypto';
import {activeReview,reviewSignature} from '../public/order-review-policy.js';
import {updateOrderReview} from './order-review-model.mjs';
const clean=(v,max=4000)=>{if(typeof v!=='string'||v.length>max)throw Error('Enter a valid text value.');return v.trim();};
function approvedChange(r,c,id){
 const change=r.changes.find(v=>v.id===id&&v.status==='Approved');if(!change)return false;
 const order=r.contracts.at(-1),path=change.path;let value;
 if(change.target==='review'&&path){if(path.scope==='field')value=r.fields[path.field];else if(path.scope==='price')value=order.price?.[path.field];else if(path.scope==='product')value=order.products[path.index]?.fields[path.field];else if(path.scope==='extra')value=order.extras[path.index]?.[path.field];else if(path.scope==='contractDate')value=order['Signed Contract Date']||r.fields['Signed Contract Date'];}
 else if(change.target==='price')value=order.price?.[change.field];else if(change.target==='product')value=order.products[change.index]?.fields[change.field];else if(change.field)value=r.fields[change.field];
 if(change.value===undefined||JSON.stringify(value)!==JSON.stringify(change.value))return false;
 const baseline=r.documentReview?.rounds.find(v=>v.id===c.roundId),source=r.documents.find(d=>d.id===r.contractEvidence?.documentId);
 if(r.contracts.at(-1).version<=c.version||r.contractEvidence?.version!==r.contracts.at(-1).version||!source||baseline?.baseline.documents.some(d=>d.id===source.id))return false;
 if(change.itemId===c.itemId)return true;
 if(change.baseVersion<c.version)return false;
 if(change.target==='price')return c.group==='pricing'&&(c.itemId==='final-balance'||c.itemId==='price-'+change.field);
 const lines=Array.isArray(c.currentValue)?c.currentValue:c.currentValue?.products||[],groups=new Set(lines.map(line=>line.group));
 return change.target==='product'&&groups.has(r.contracts.find(v=>v.version===c.version)?.products[change.index]?.group);
}
export const openCorrection=c=>c.status!=='Resolved';
export function canRespond(record,correction,context){return context.role==='rep'&&record.fields['Rep Name']===context.rep&&correction?.assignedTo==='Rep'&&openCorrection(correction)&&(correction.responseVersion||correction.version)===record.contracts.at(-1)?.version;}
export function repDocuments(record){return record.documents.filter(d=>d.label!=='Other'||d.responseForCorrectionId);}
export function correctionProjection(record){
  return (record.reviewCorrections||[]).filter(c=>c.assignedTo==='Rep').map(c=>({id:c.id,itemId:c.itemId,label:c.label,section:c.section,group:c.group,version:c.version,status:c.status,assignedTo:c.assignedTo,request:c.request,proposed:c.proposed,dueAt:c.dueAt,at:c.at,by:c.by,adminName:c.adminName||c.by,responseVersion:c.responseVersion,requiredNotes:c.requiredNotes,waitingFor:c.waitingFor,messages:c.messages||[],update:c.update,evidenceIds:c.evidenceIds.filter(id=>repDocuments(record).some(d=>d.id===id)),responses:c.responses,resolutions:c.resolutions||[],resolution:c.resolution,resolvedAt:c.resolvedAt,resolvedBy:c.resolvedBy,history:c.history}));
}
export function updateCorrection(r,b,ctx,event){
  if(b.revision!==r.revision)throw Error('This record changed. Refresh before saving.');
  r.reviewCorrections||=[];const at=new Date().toISOString();
  if(b.action==='correction-create'){
    if(ctx.role!=='management')throw Error('Management permission is required.');
    if(b.confirmed!==true)throw Error('Confirm Yes before creating the revision.');
    const round=activeReview(r),item=round?.items.find(i=>i.id===b.itemId);
    if(!item||round.signature!==reviewSignature(r))throw Error('Start a current source review before raising a revision.');
    if(r.reviewCorrections.some(c=>c.itemId===item.id&&openCorrection(c)))throw Error('This check already has an open revision. Use its existing action.');
    const request=clean(b.request||''),proposed=clean(b.proposed||'');if(!request)throw Error('Explain the correction or clarification required.');
    if(!['Rep','Management'].includes(b.assignedTo))throw Error('Choose Rep or Management.');
    const dueAt=b.dueAt?new Date(b.dueAt).toISOString():'';
    const evidenceIds=Array.isArray(b.evidenceIds)?[...new Set(b.evidenceIds)]:[];
    if(evidenceIds.some(id=>!r.documents.some(d=>d.id===id)))throw Error('Choose attached evidence from this client.');
    if(b.assignedTo==='Rep'&&evidenceIds.some(id=>!repDocuments(r).some(d=>d.id===id)))throw Error('Internal Other attachments are not shared with the rep. Choose a client source document.');
    r.reviewCorrections.push({id:randomUUID(),itemId:item.id,label:item.label,section:item.section,group:item.group,version:r.contracts.at(-1).version,roundId:round.id,currentValue:structuredClone(item.value??null),request,proposed,assignedTo:b.assignedTo,dueAt,evidenceIds,requiresSignedChange:b.requiresSignedChange===true,status:'Awaiting Response',at,by:ctx.actor,responses:[],history:[{at,by:ctx.actor,action:'Revision raised'}]});
    if(r.crossover?.reviews)delete r.crossover.reviews[item.group];
    if(!round.finalizedAt)delete round.answers[item.id];
    event(r,ctx,'Review Corrections',`${item.label}: separate revision action raised for ${b.assignedTo}.`);
  }else{
    const c=r.reviewCorrections.find(c=>c.id===b.correctionId);if(!c)throw Error('Revision not found.');
    if(b.action==='correction-respond'){
      if(!canRespond(r,c,ctx))throw Error('Only the assigned rep can edit their response to an open revision.');
      if((c.responseVersion||c.version)!==r.contracts.at(-1)?.version)throw Error('The signed order version changed. Ask Management to review this request.');
      const response=clean(b.response||''),proposed=clean(b.proposed||'');if(!response)throw Error('Enter your response.');
      const evidenceIds=Array.isArray(b.evidenceIds)?[...new Set(b.evidenceIds)]:[];
      if(evidenceIds.some(id=>!r.documents.some(d=>d.id===id&&d.responseForCorrectionId===c.id)))throw Error('Use supporting evidence attached to this revision response.');
      // Append response versions. Rep input never updates source values, checks or decisions.
      c.responses.push({id:randomUUID(),response,proposed,evidenceIds,at,by:ctx.actor,rep:ctx.rep});c.status='Responded';
      c.waitingFor='Admin';delete c.updateConfirmation;
      c.history.push({at,by:ctx.actor,action:'Rep response saved'});
      event(r,ctx,'Review Corrections',`${c.label}: rep response saved for Management review.`);
    }else if(b.action==='correction-assess'){
      if(ctx.role!=='management')throw Error('Management permission is required.');
      updateOrderReview(r,{action:'review-answer',revision:r.revision,itemId:c.itemId,state:'Needs Fix',note:c.requiredNotes||c.request,cause:b.cause},ctx,event);
      c.assessmentCause=activeReview(r).answers[c.itemId].cause;c.history.push({at,by:ctx.actor,action:'Issue assessed: '+c.assessmentCause});
    }else if(b.action==='correction-message'){
      if(ctx.role!=='management')throw Error('Management permission is required.');
      if(!openCorrection(c))throw Error('Reopen this revision before replying.');
      const message=clean(b.message||'');if(!message)throw Error('Enter the Admin reply.');
      if(!['Rep','Admin'].includes(b.waitingFor))throw Error('Choose whose response is required.');
      if(b.waitingFor==='Rep'&&c.assignedTo!=='Rep')throw Error('This internal revision is not assigned to the rep.');
      c.messages||=[];c.messages.push({id:randomUUID(),role:'Admin',text:message,at,by:ctx.actor});c.adminName=ctx.actor;c.waitingFor=b.waitingFor;delete c.updateConfirmation;
      c.history.push({at,by:ctx.actor,action:'Admin reply saved'});event(r,ctx,'Review Corrections',`${c.label}: Admin reply saved; awaiting ${c.waitingFor}.`);
    }else if(b.action==='correction-attention'){
      if(ctx.role!=='management')throw Error('Management permission is required.');
      const message=clean(b.message||'');if(!message)throw Error('Explain what requires attention.');
      if(!['Rep','Admin'].includes(b.waitingFor))throw Error('Choose whose response is required.');
      if(b.waitingFor==='Rep'&&c.assignedTo!=='Rep')throw Error('This internal revision is not assigned to the rep.');
      if(r.reviewCorrections.some(other=>other.id!==c.id&&other.itemId===c.itemId&&openCorrection(other)))throw Error('Another open revision already covers this check.');
      if(c.resolvedAt){c.resolutions||=[];c.resolutions.push({at:c.resolvedAt,by:c.resolvedBy,resolution:c.resolution});}
      Object.assign(c,{status:'Require Attention',requiredNotes:message,responseVersion:r.contracts.at(-1).version,waitingFor:b.waitingFor,adminName:ctx.actor,resolvedAt:'',resolvedBy:'',resolution:''});delete c.updateConfirmation;
      c.messages||=[];c.messages.push({id:randomUUID(),role:'Admin',text:message,at,by:ctx.actor});
      if(r.crossover?.reviews)delete r.crossover.reviews[c.group];
      c.history.push({at,by:ctx.actor,action:'Require Attention'});event(r,ctx,'Review Corrections',`${c.label}: requires attention; awaiting ${c.waitingFor}.`);
    }else if(b.action==='correction-prepare-update'){
      if(ctx.role!=='management')throw Error('Management permission is required.');
      if(!openCorrection(c))throw Error('This revision is resolved.');
      const resolution=clean(b.resolution||'');if(!resolution)throw Error('Record why this outcome is accepted.');
      const change=r.changes.find(v=>v.id===b.changeId);if(!change)throw Error('Choose a controlled order change. Create the signed order proposal from the checklist first.');
      const pending=change.status==='Pending'&&change.target==='review'&&change.itemId===c.itemId;
      if(pending){
        const batch=r.changes.filter(v=>v.target==='review'&&v.status==='Pending'&&v.baseVersion===r.contracts.at(-1).version);
        if(batch.length!==1)throw Error('Apply multiple pending changes through the signed-order batch workflow, then record the approved update here.');
        // Validate against a clone: preparing the confirmation never applies the change.
        updateOrderReview(structuredClone(r),{...b,action:'review-apply-change'},ctx,()=>{});
      }else if(!approvedChange(r,c,b.changeId))throw Error('Choose an approved same-item change with fresh signed evidence.');
      c.updateConfirmation={token:randomUUID(),by:ctx.actor,expiresAt:Date.now()+5*60000,version:r.contracts.at(-1).version,stamp:reviewSignature(r),change:JSON.stringify(change),revision:r.revision+1,plan:{pending,changeId:change.id,documentId:b.documentId,signedDate:b.signedDate,acceptanceReference:b.acceptanceReference,acceptanceConfirmed:b.acceptanceConfirmed===true,resolution},before:structuredClone(change.old),after:structuredClone(change.value),field:change.field};
      event(r,ctx,'Review Corrections',`${c.label}: update preview prepared; confirmation required.`);
    }else if(b.action==='correction-cancel-update'){
      if(ctx.role!=='management')throw Error('Management permission is required.');
      if(c.updateConfirmation?.token===b.token&&c.updateConfirmation.by===ctx.actor){delete c.updateConfirmation;c.history.push({at,by:ctx.actor,action:'Update preview cancelled'});event(r,ctx,'Review Corrections',`${c.label}: update cancelled; source values unchanged.`);}
    }else if(b.action==='correction-confirm-update'){
      if(ctx.role!=='management')throw Error('Management permission is required.');
      const confirmation=c.updateConfirmation,change=r.changes.find(v=>v.id===confirmation?.plan.changeId);
      if(!openCorrection(c)||b.confirmed!==true||!confirmation||confirmation.token!==b.token||confirmation.by!==ctx.actor||confirmation.expiresAt<Date.now()||confirmation.revision!==r.revision||confirmation.stamp!==reviewSignature(r)||confirmation.change!==JSON.stringify(change))throw Error('Update confirmation is missing, expired or stale. Review the update again.');
      const plan=confirmation.plan;
      if(plan.pending)updateOrderReview(r,{action:'review-apply-change',revision:r.revision,...plan},ctx,event);
      else if(!approvedChange(r,c,plan.changeId))throw Error('The approved change is no longer current.');
      if(c.update){c.updates||=[];c.updates.push(structuredClone(c.update));}
      Object.assign(c,{status:'Resolved',resolution:plan.resolution,resolvedAt:at,resolvedBy:ctx.actor,adminName:ctx.actor,waitingFor:'',changeId:plan.changeId,update:{at,by:ctx.actor,version:r.contracts.at(-1).version,field:confirmation.field,before:confirmation.before,after:confirmation.after}});delete c.updateConfirmation;
      c.history.push({at,by:ctx.actor,action:plan.pending?'Confirmed update applied to new signed order version':'Approved order update confirmed'});
      if(r.crossover?.reviews)delete r.crossover.reviews[c.group];event(r,ctx,'Review Corrections',`${c.label}: Update confirmed; source checks require rechecking.`);
    }else if(b.action==='correction-resolve'){
      if(ctx.role!=='management')throw Error('Management permission is required.');
      if(!openCorrection(c))throw Error('This revision is already resolved.');
      const resolution=clean(b.resolution||'');if(!resolution)throw Error('Record the Management decision and resolution.');
      if(c.requiresSignedChange&&!approvedChange(r,c,b.changeId))throw Error('Apply the approved signed-order revision for this item with fresh verified signed evidence before resolving this action.');
      Object.assign(c,{status:'Resolved',resolution,resolvedAt:at,resolvedBy:ctx.actor,changeId:c.requiresSignedChange?b.changeId:''});c.history.push({at,by:ctx.actor,action:'Management resolved revision'});
      c.waitingFor='';c.adminName=ctx.actor;delete c.updateConfirmation;
      event(r,ctx,'Review Corrections',`${c.label}: revision resolved. Source checks still require current verification.`);
    }else throw Error('Unsupported revision action.');
  }
  return r;
}
