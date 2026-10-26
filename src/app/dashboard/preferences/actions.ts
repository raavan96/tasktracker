'use server';
import {workspaceRead} from '@/lib/workspace-data';
import {cleanView,type SavedTaskView} from '@/lib/task-views';
import {landingPages} from '@/lib/workspace-preferences';
export async function saveStartPage(path:string){try{return await workspaceRead(async(db,user)=>{
 if(!landingPages.some(p=>p.value===path))throw new Error('Choose a start page from the list.');
 await db.query('INSERT INTO workspace_preferences(user_id,landing_page) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET landing_page=excluded.landing_page',[user,path]);
 return {error:''};
 });}catch{return {error:'Start page could not be saved. Please retry.'};}}
export async function setProjectFavorite(project:string,favorite:boolean){try{return await workspaceRead(async(db,user)=>{
 if(typeof favorite!=='boolean'||!(/^[0-9a-f-]{36}$/i.test(project)))throw new Error('Choose a valid project.');
 if(!(await db.query('SELECT id FROM projects WHERE id=$1',[project])).rowCount)throw new Error('Project unavailable.');
 if(favorite)await db.query('INSERT INTO project_favorites(user_id,project_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[user,project]);
 else await db.query('DELETE FROM project_favorites WHERE user_id=$1 AND project_id=$2',[user,project]);
 return {error:''};
 });}catch{return {error:'Favorite could not be saved. Refresh and try again.'};}}
export async function saveTaskView(name:string,input:unknown){try{return await workspaceRead(async(db,user)=>{
 if(typeof name!=='string'||!name.trim()||name.trim().length>60)throw new Error('Name this view using 1–60 characters.');
 const filters=cleanView(input);
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[user]);
 if(Number((await db.query('SELECT count(*) n FROM saved_task_views WHERE user_id=$1',[user])).rows[0].n)>=20)throw new Error('You can keep 20 saved views. Remove one before adding another.');
 await db.query('INSERT INTO saved_task_views(user_id,name,filters) VALUES($1,$2,$3)',[user,name.trim(),JSON.stringify(filters)]);
 return {error:'',views:(await db.query<SavedTaskView>('SELECT id,name,filters FROM saved_task_views WHERE user_id=$1 ORDER BY name,id',[user])).rows};
 });}catch(e){return {error:e instanceof Error&&e.message.includes('unique')?'A view with this name already exists.':e instanceof Error?e.message:'View could not be saved.',views:null};}}
export async function deleteTaskView(id:string){return workspaceRead(async(db,user)=>{await db.query('DELETE FROM saved_task_views WHERE id=$1 AND user_id=$2',[id,user]);return (await db.query<SavedTaskView>('SELECT id,name,filters FROM saved_task_views WHERE user_id=$1 ORDER BY name,id',[user])).rows;});}
export async function saveNotificationPreferences(input:{deadline_days:number;mentions:boolean;assignments:boolean;reviews:boolean}){try{return await workspaceRead(async(db,user)=>{
 if(![0,1,3,7].includes(input.deadline_days)||['mentions','assignments','reviews'].some(k=>typeof input[k as keyof typeof input]!=='boolean'))throw new Error('Choose valid notification preferences.');
 await db.query('INSERT INTO notification_preferences(user_id,deadline_days,mentions,assignments,reviews) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id) DO UPDATE SET deadline_days=excluded.deadline_days,mentions=excluded.mentions,assignments=excluded.assignments,reviews=excluded.reviews',[user,input.deadline_days,input.mentions,input.assignments,input.reviews]);return {error:''};
 });}catch{return {error:'Preferences could not be saved. Please retry.'};}}
