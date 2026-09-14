'use server';
import {revalidatePath} from 'next/cache';
import {createPlan,storeTemplate,removeTemplate} from '@/lib/planning';
import type {PlanInput,PlanningSource} from '@/lib/planning-types';
function message(error:unknown){if(error instanceof Error){const code=(error as Error & {code?:string}).code;return !code||code==='P0001'?error.message:'The copy could not be saved. Check that all members still have access and try again.';}return 'Please try again.';}
export async function submitPlan(input:PlanInput){try{const result=await createPlan(input);revalidatePath('/dashboard','layout');return {success:true,...result};}catch(error){return {error:message(error)};}}
export async function savePlanningTemplate(source:PlanningSource,version:string,name:string){try{await storeTemplate(source,version,name);revalidatePath('/dashboard/templates');return {success:true};}catch(error){return {error:message(error)};}}
export async function deletePlanningTemplate(id:string){try{await removeTemplate(id);revalidatePath('/dashboard/templates');return {success:true};}catch(error){return {error:message(error)};}}
