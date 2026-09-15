'use server';
import {workspaceRead} from '@/lib/workspace-data';
import {bulkTasks,type BulkChange,type BulkSelection} from '@/lib/postgres/bulk-tasks';
import {revalidatePath} from 'next/cache';
export async function previewBulkTasks(selection:BulkSelection[],change:BulkChange){try{return {error:'',results:await workspaceRead((db,user)=>bulkTasks(db,user,selection,change))};}catch(e){return {error:e instanceof Error?e.message:'Preview failed.',results:[]};}}
export async function applyBulkTasks(selection:BulkSelection[],change:BulkChange){try{
 const results=await workspaceRead((db,user)=>bulkTasks(db,user,selection,change,true));
 for(const path of ['/dashboard','/dashboard/tasks','/dashboard/my-tasks','/dashboard/workload','/dashboard/calendar','/dashboard/archive'])revalidatePath(path);
 revalidatePath('/dashboard/projects/[id]','page');return {error:'',results};
 }catch{return {error:'The batch could not be confirmed. Refresh to check the results before retrying.',results:[]};}}
