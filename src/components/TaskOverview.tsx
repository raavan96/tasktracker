import {cookies} from 'next/headers';
import {currentUser} from '@/lib/postgres/auth';
import SummaryDisclosure from './SummaryDisclosure';
import OverviewCards from './OverviewCards';
import {taskOverview} from '@/lib/workspace-data';
export default async function TaskOverview({mine=false}:{mine?:boolean}){
 const [counts,user,jar]=await Promise.all([taskOverview(mine),currentUser(),cookies()]);
 const preference='tasktracker-summary-'+(mine?'mine-':'all-')+user?.id;
 const initialOpen=jar.get(preference)?.value==='true';
 const base=mine?'/dashboard/my-tasks':'/dashboard/tasks';
 return <SummaryDisclosure label={mine?'My task overview':'All task overview'} preference={preference} initialOpen={initialOpen} summary={`Overdue ${counts.overdue} · Due today ${counts.today} · In progress ${counts.in_progress} · Review ${counts.in_review} · Completed ${counts.done}`}><OverviewCards label={mine?'My task summary counts':'All task summary counts'} items={[
 {id:'overdue',label:'Overdue'}, {id:'today',label:'Due today'}, {id:'in_progress',label:'In progress'}, {id:'in_review',label:'Awaiting review'}, {id:'done',label:'Completed'}
 ].map(({id,label})=>({id,label,value:Number(counts[id as keyof typeof counts]),href:`${base}?summary=${id}`,hint:mine?'View my tasks':'View tasks'}))}/></SummaryDisclosure>;
}
