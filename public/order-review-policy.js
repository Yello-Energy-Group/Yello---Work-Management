// Review prompts are metadata; source values retain canonical Sales CRM labels.
export const REVIEW_SECTIONS=['Client and Site Details','Site Details','Grid and Design','Product Check','Inventory and STC Check','Pricing and Extras','Notes and Documents'];
export function reviewSignature(r){const fields={...r.fields};delete fields['Last Activity'];delete fields['Last Update'];return JSON.stringify({schema:3,fields,contract:r.contracts.at(-1),documents:r.documents.map(d=>[d.id,d.bytes]),signedEvidence:r.contractEvidence,operational:{stc:r.crossover?.stc,inventory:r.crossover?.inventory,extras:r.crossover?.extras},grid:{fields:['Grid Status','Grid Provider','NMI','Grid Applied Date','Approval Number','Approval Date'].map(k=>[k,r.gridReview?.fields[k]]),files:r.gridReview?.files.filter(f=>f.group==='grid').map(f=>[f.id,f.name,f.sample])}});}
export function activeReview(r){return r.documentReview?.rounds?.at(-1);}
export function reviewItems(r){
 const c=r.contracts.at(-1),f=r.fields,p=c?.price||{},products=c?.products||[],items=[];
 const subset=names=>products.filter(p=>names.includes(p.group)),vals=keys=>Object.fromEntries(keys.map(k=>[k,f[k]]));
 const panels=subset(['Panels']),battery=subset(['Battery']),racking=subset(['Racking']),inverters=subset(['Inverter 1','Inverter 2']),extra=products.filter(p=>!['Panels','Battery','Inverter 1','Inverter 2','Racking'].includes(p.group));
 const hasExtras=!!c?.extras?.length,comparison=(key,sources)=>({key,sources});
 const add=(id,label,group,section,value,sources,options={})=>{const item={id,label,group,section,value,sources,...options};items.push(item);return item;};
 const field=(key,label,section='Site Details',sources=['Signed Contract'],optional=false)=>add('field-'+key,label,'order',section,f[key],sources,{target:{scope:'field',field:key},optional});
 field('Legal Name','Legal Name','Client and Site Details',['Identification']).comparisons=[comparison('Signed Contract',['Signed Contract'])];
 add('client-address','Location, Suburb, Postcode','order','Client and Site Details',vals(['Location','Suburb','Postcode']),['Identification','Electricity Bill'],{requiredValues:['Location','Suburb','Postcode'],comparisons:[comparison('Signed Contract',['Signed Contract'])]});
 add('signed-status','Contract Signed','order','Client and Site Details',{'Signed Contract Status':f['Signed Contract Status'],'Signed Contract Date':c?.['Signed Contract Date']||f['Signed Contract Date'],'Sale Submission History':r.submissionHistory},['Signed Contract'],{target:{scope:'contractDate',field:'Signed Contract Date'},requiredValues:['Signed Contract Status','Signed Contract Date','Sale Submission History'],invalid:f['Signed Contract Status']!=='Signed',instructions:'Verify signature, signer and Signed Contract Date against submission history. A filename does not prove signing.'});
 field('Email 1','Email Present','Client and Site Details');field('Contact 1','Contact Given','Client and Site Details');
 for(const [key,label] of [['Site Type','Site Type Check'],['System Type','System Type Check'],['Phase Type','Phase Check'],['Roof Type','Roof Check'],['Height','Height Check']])field(key,label);
 field('NMI','NMI Check','Site Details',['Electricity Bill']);field('Building Type','Building Type');
 field('Strata Managed','Strata Managed','Site Details',['Signed Contract','Strata Approval'],(f['Building Type']||[]).includes('Torrens Title'));
 add('inspection-done','Inspection Done','order','Site Details',vals(['Site Visit','Remote Site Visit','Site Visit Notes','Remote Visit Notes']),['Site Legend','Other','Signed Contract'],{optional:f['Site Visit']==='Visit not Required',invalid:f['Site Visit']!=='Visit Done'&&!(f['Remote Site Visit']||[]).some(v=>['Pictures Given','Video Given','Video Call','Google View'].includes(v)),instructions:'Verify the inspection findings. A requested or scheduled visit is not complete; remote evidence must actually support the review.'});
 const gkeys=['Grid Status','Grid Provider','NMI','Approval Number','Approval Date'];
 add('grid-approval','Grid Approval Done','grid','Grid and Design',Object.fromEntries(gkeys.map(k=>[k,r.gridReview?.fields[k]])),['Grid + Meter File'],{scored:false,requiredValues:gkeys,invalid:r.gridReview?.fields['Grid Status']!=='Grid Approved'});
 for(const [id,label,source,needed] of [['pv-design','PV Design Approved','PV Design',panels.length],['battery-location','Battery Location Approved','Battery Location',battery.length],['ev-location','EV charger Location','Other',products.some(p=>p.group==='EV Charger')]])add(id,label,'grid','Grid and Design',r.documents.filter(d=>d.label===source),[source],{scored:false,optional:!needed,instructions:source==='Other'?'Use the actual EV charger location plan attached as Other, with its approval reference.':'Verify design/location approval, job identity and current products. Upload alone is not approval.'});
 for(const [id,label,lines] of [['pv-match','PV Match',panels.length?products.filter(p=>['Panels','Inverter 1','Inverter 2'].includes(p.group)):[]],['battery-match','Battery Match',battery],['racking-match','Racking Match',racking],['extra-product-match','Extra Product Match',extra]])add(id,label,'products','Product Check',lines,['Signed Contract'],{optional:!lines.length,instructions:'Match every sold model, specification and quantity, including repeated lines and approved changes.'});
 const stc=r.crossover?.stc||{};
 for(const [id,label,v,hint] of [
  ['stc-correct','STC Correct',{platform:stc.platform,creator:stc.creator,reference:stc.reference,completedAt:stc.completedAt},'Verify the completed Bridgeselect job and reference.'],
  ['stc-electrician','STC Electrician Correct','Verify the electrician on the attached STC record.','Compare with authorised job instructions. Creator is not the electrician; the assigned-electrician source is not connected.'],
  ['stc-product','STC Product Correct',products,'Match the full product schedule with the signed source.'],
  ['stc-client','STC Client Details Correct',vals(['Legal Name','Email 1','Contact 1']),'Match identity and contact details.'],
  ['stc-site','STC Site Details Correct',vals(['Location','Suburb','Postcode','Site Type','Phase Type','NMI']),'Match installation address and supply details.']
 ])add(id,label,'stc','Inventory and STC Check',v,['Other'],{scored:false,instructions:'Attach the actual STC export/screenshot as Other. '+hint,comparisons:[comparison(id==='stc-electrician'?'Authorised Job Instructions':'Signed Contract',id==='stc-electrician'?['Other']:['Signed Contract']),...(id==='stc-site'?[comparison('Electricity Bill',['Electricity Bill'])]:[])],...(id==='stc-correct'?{requiredValues:['platform','creator','reference','completedAt']}: {})});
 const inv=r.crossover?.inventory||{},lines=values=>values.map(line=>({group:line.group,fields:line.fields,inventory:inv.lines?.[products.indexOf(line)]})),sizes=(values,key)=>values.map(line=>({[key]:line.fields[key]}));
 for(const [id,label,v,optional] of [
  ['inventory-system-size','System Size Correct',sizes(panels,'System Size'),!panels.length],
  ['inventory-battery-size','Battery Size Correct',sizes(battery,'Battery Size'),!battery.length],
  ['inventory-panels','Panel Product Match',lines(panels),!panels.length],
  ['inventory-inverters','Inverter Product Match',lines(inverters),!inverters.length],
  ['inventory-battery','Battery Product Match',lines(battery),!battery.length],
  ['inventory-racking','Racking Type Match',lines(racking),!racking.length],
  ['inventory-extra','Extra Order Match',{products:lines(extra),extras:c?.extras||[]},!extra.length&&!hasExtras]
 ])add(id,label,'inventory','Inventory and STC Check',v,['Other'],{scored:false,optional,comparisons:[comparison('Signed Contract',['Signed Contract'])],instructions:'Compare the actual Inventory reservation/packing source (attached as Other) with signed sizes, products and quantities. Ordered alone is not ready.'});
 for(const [id,label,key] of [['price-Total Price','Total Price Correct','Total Price'],['price-OFP Balance','OFP Correct','OFP Balance'],['price-Extra Balance','Extra Price Match','Extra Balance'],['price-Deposit','Deposit Correct','Deposit']])add(id,label,'pricing','Pricing and Extras',p[key],['Signed Contract'],{target:{scope:'price',field:key}});
 add('final-balance','Balance Price Correct','pricing','Pricing and Extras',{'OFP Balance':p['OFP Balance'],'Extra Balance':p['Extra Balance'],'Final OFP Balance':Number.isFinite(p['OFP Balance'])&&Number.isFinite(p['Extra Balance'])?(Math.round(p['OFP Balance']*100)+Math.round(p['Extra Balance']*100))/100:null,'OFP Pay Mode':p['OFP Pay Mode'],'Payment Notes':p['Payment Notes'],...(c?.finance||{})},['Signed Contract'],{requiredValues:['OFP Balance','Extra Balance','Final OFP Balance','OFP Pay Mode']});
 add('extras-given','Extra Given','extras','Pricing and Extras',c?.extras||[],['Signed Contract'],{optional:!hasExtras,instructions:'Verify the signed extras. When none were sold, record Not Applicable with a source reason.'});
 add('extras-match','Extras Match','extras','Pricing and Extras',{extras:c?.extras||[],arrangements:r.crossover?.extras?.items||[]},['Signed Contract'],{optional:!hasExtras,instructions:'Match scope, quantities and amounts to signed extras and their organised arrangements.'});
 const mandatory=['Signed Contract','Identification','Electricity Bill',...(panels.length?['PV Design']:[]),...(battery.length?['Battery Location']:[])];
 add('mandatory-documents','Mandatory Document Match','order','Notes and Documents',r.documents.filter(d=>mandatory.includes(d.label)),['Signed Contract'],{comparisons:mandatory.filter(label=>label!=='Signed Contract').map(label=>comparison(label,[label])),instructions:'Review every required file for the correct client/site, readable content, format and current version.'});
 const other=r.documents.filter(d=>!mandatory.includes(d.label));
 add('other-documents','Other Document Match','order','Notes and Documents',other,[...new Set(other.map(d=>d.label))],{optional:!other.length,comparisons:other.slice(1).map(d=>({...comparison(d.name,[d.label]),documentId:d.id})),instructions:'Review every remaining attachment, including Grid/Meter evidence, for the correct job, readable content, format and version.'});
 field('Site Instructions / Rep Advice','Site Instructions Clear','Notes and Documents',['Signed Contract','Site Legend','Other']);
 add('final-admin','Final Review by Admin','order','Notes and Documents','Confirm all other items have been assessed and issues resolved.',['Signed Contract'],{scored:false,instructions:'Complete last. This records Admin review; confirmed Submission is still separate.'});
 return items;
}
export function reviewSection(item){return item.section||({grid:'Grid Approval',products:'Products',pricing:'Pricing & Finance',extras:'Extras'}[item.group])||'Client Details';}
export function reviewScore(round){
  if(!round)return {score:null,covered:0,total:0,unclassified:0};
  const all=Object.entries(round.firstFindings||{}),first=all.filter(([id])=>round.items.find(i=>i.id===id)?.scored!==false).map(([,v])=>v),unclassified=first.filter(v=>v.state==='Needs Fix'&&v.cause==='Unclear').length;
  const considered=first.filter(v=>v.state==='Checked'||(v.state==='Needs Fix'&&v.cause==='Rep Submission'));
  const score=considered.length?Math.round(100*considered.filter(v=>v.state==='Checked').length/considered.length):null;
  return {score:unclassified?null:score,covered:all.length,total:round.items.length,unclassified};
}
export function reviewBlockers(r,group){
  if((r.reviewCorrections||[]).some(c=>c.group===group&&c.status!=='Resolved'))return ['Resolve the open review revision for this section.'];
  if(!r.reviewRequired&&!r.documentReview)return [];
  const round=activeReview(r);
  if(!round||round.signature!==reviewSignature(r))return ['Start a current source-document review.'];
  const items=round.items.filter(i=>i.group===group);
  if(!round.finalizedAt)return ['Complete and finalise the source-document review first.'];
  if(items.some(i=>!['Checked','Not Applicable'].includes(round.answers[i.id]?.state)))return ['Resolve the source-document issues in this section.'];
  return [];
}
