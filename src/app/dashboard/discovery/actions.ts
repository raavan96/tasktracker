'use server';
import {taskPage,type TaskFilters} from '@/lib/workspace-data';
export async function getTaskPage(filters:TaskFilters){try{return {...await taskPage(filters),error:''};}catch(e){return {items:[],total:0,page:1,people:[],projects:[],views:[],error:e instanceof Error?e.message:'Tasks could not load.'};}}
export async function exportTasks(filters:TaskFilters){try{return {items:(await taskPage(filters,true)).items,error:''};}catch(e){return {items:[],error:e instanceof Error?e.message:'Export failed.'};}}
