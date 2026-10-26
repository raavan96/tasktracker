import type {TaskFilters} from './workspace-data';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function taskRouteFilters(params:Record<string,string|string[]|undefined>,mine=false):TaskFilters{
 const get=(name:string)=>{const value=params[name];return Array.isArray(value)?value[0]||'':value||'';};
 return {q:get('q').slice(0,200),summary:get('summary')||'all',assignee:get('assignee')==='unassigned'||uuid.test(get('assignee'))?get('assignee'):'all',sort:get('sort')||'deadline',project:uuid.test(get('project'))?get('project'):undefined,priority:get('priority')||'all',status:get('status')||'all',archived:false,mine:mine||get('mine')==='true',preset:get('preset')||'all',page:Math.max(1,Math.trunc(Number(get('page'))||1))};
}
export function taskRequestKey(filters:TaskFilters){return JSON.stringify({q:filters.q||'',summary:filters.summary||'all',assignee:filters.assignee||'all',sort:filters.sort||'deadline',project:filters.project||undefined,priority:filters.priority||'all',status:filters.status||'all',archived:Boolean(filters.archived),mine:Boolean(filters.mine),preset:filters.preset||'all'});}
