export type RemarkDraft = {
 version:1; userId:string; taskId:string; text:string; mentions:string[]; updatedAt:number;
 editing:null|{id:string;edit_version:number}; request:null|{key:string;id:string};
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const remarkDraftKey=(user:string,task:string)=>`tasktracker:remark-draft:${user}:${task}`;
export function parseRemarkDraft(raw:string,user:string,task:string,now=Date.now()):RemarkDraft|null {
 try {
  const d=JSON.parse(raw);
  if(d.version!==1||d.userId!==user||d.taskId!==task||typeof d.text!=='string'||!d.text.trim()||d.text.length>10000||!Array.isArray(d.mentions)||d.mentions.length>30||d.mentions.some((id:unknown)=>typeof id!=='string'||!uuid.test(id))||!Number.isFinite(d.updatedAt)||d.updatedAt>now+60000||now-d.updatedAt>7*86400000)return null;
  if(d.editing&&(!uuid.test(d.editing.id)||!Number.isSafeInteger(d.editing.edit_version)||d.editing.edit_version<0))return null;
  if(d.request&&(!uuid.test(d.request.id)||typeof d.request.key!=='string'||d.request.key.length>24000))return null;
  return d;
 } catch {return null;}
}
export function draftMatchesSaved(draft:RemarkDraft,item:{id:string;content:string;mentions:string[];edit_version:number}) {
 const same=item.content===draft.text.trim()&&JSON.stringify([...item.mentions].sort())===JSON.stringify([...new Set(draft.mentions)].sort());
 return same&&(draft.editing?item.id===draft.editing.id&&Number(item.edit_version)===draft.editing.edit_version+1:item.id===draft.request?.id);
}
