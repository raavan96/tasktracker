export type HistoryEntry={id:string;project_id:string;task_id:string|null;entity:string;entity_id:string|null;action:string;title:string;project_name:string;actor_id:string|null;actor_name:string;created_at:string;transaction_id?:string|null;changes:Record<string,{before?:unknown;after?:unknown}>;project_exists:boolean;task_exists:boolean};
const statuses:Record<string,string>={todo:'To do',in_progress:'In progress',blocked:'Blocked',in_review:'In review',done:'Completed'};
const decisions:Record<string,string>={submit:'submitted the task for review',approve:'approved the task',changes:'requested changes to the task',withdraw:'withdrew the task from review',reopen:'reopened the task'};
export function historyAction(e:HistoryEntry,names:Map<string,string>):string{
 const after=(key:string)=>e.changes[key]?.after;
 if(e.entity==='Reviews')return decisions[String(after('decision'))]||'recorded a review action for the task';
 if(e.action.startsWith('membership ')){const id=e.changes.user_id?.[e.action.endsWith('deleted')?'before':'after'];return `${e.action.endsWith('deleted')?'removed':'added'} ${names.get(String(id))||'a member'} ${e.action.endsWith('deleted')?'from':'to'} the project`;}
 if(e.action.startsWith('note '))return `${e.action.endsWith('deleted')?'removed':e.action.endsWith('created')?'added':'edited'} a project note`;
 if(e.action==='accepted')return 'recorded acceptance of the task';
 if(e.action.startsWith('dependency '))return e.action.endsWith('deleted')?'removed a task dependency':'added a task dependency';
 if(e.action.startsWith('schedule '))return 'paused' in e.changes?(after('paused')?'paused the recurring schedule':'resumed the recurring schedule'):'updated the recurring schedule';
 const object=e.entity==='Projects'?'project':e.entity==='Remarks'?'remark':e.entity==='Attachments'?'attachment':'task';
 if(e.action==='created')return `${object==='remark'||object==='attachment'?'added':'created'} ${object==='attachment'?'an':'a'} ${object}${e.task_id&&object!=='task'?' to the task':''}`;
 if(e.action==='deleted')return `removed the ${object}${e.task_id&&object!=='task'?' from the task':''}`;
 const fields=Object.keys(e.changes);
 let action='';
 if(e.entity==='Projects'&&after('completed_at'))action='completed the project';
 else if('is_archived' in e.changes)action=`${after('is_archived')===true||after('is_archived')==='true'?'archived':'restored'} the ${object}`;
 else if('status' in e.changes)action=`changed the task status to ${statuses[String(after('status'))]||String(after('status'))}`;
 else if('due_date' in e.changes)action=after('due_date')?'changed the task deadline':'removed the task deadline';
 else if('assignee_ids' in e.changes||'assignee_id' in e.changes)action='changed the task assignees';
 else if('priority' in e.changes)action='changed the task priority';
 else if('is_private' in e.changes)action='changed project visibility';
 else action=`edited the ${object}`;
 return action+(fields.length>1&&!(e.entity==='Projects'&&fields.every(f=>['is_archived','completed_at'].includes(f)))?' and other details':'');
}
export function groupHistory(items:HistoryEntry[]):HistoryEntry[][]{
 const consumed=new Set<string>(),groups:HistoryEntry[][]=[];
 const expected:Record<string,string>={submit:'in_review',approve:'done',changes:'in_progress',withdraw:'in_progress',reopen:'in_progress'};
 for(const item of items){
  if(consumed.has(item.id))continue;
  // Only pair a single review with its status-only change in the same database
  // transaction, task and actor. Old records have no transaction ID: keep separate.
  const related=item.transaction_id&&item.task_id?items.filter(e=>e.transaction_id===item.transaction_id&&e.task_id===item.task_id&&e.actor_id===item.actor_id):[];
  const reviews=related.filter(e=>e.entity==='Reviews'&&e.action==='created'&&expected[String(e.changes.decision?.after)]);
  const review=reviews.length===1?reviews[0]:undefined;
  const transitions=review?related.filter(e=>e.entity==='Tasks'&&e.action==='updated'&&Object.keys(e.changes).length===1&&e.changes.status?.after===expected[String(review.changes.decision?.after)]):[];
  const transition=transitions.length===1?transitions[0]:undefined;
  if(review&&transition&&(item.id===review.id||item.id===transition.id)&&!consumed.has(review.id)&&!consumed.has(transition.id)){
   groups.push([review,transition]);consumed.add(review.id);consumed.add(transition.id);
  }else{groups.push([item]);consumed.add(item.id);}
 }
 return groups;
}
