import OverviewCards from './OverviewCards';
import {taskOverview} from '@/lib/workspace-data';
export default async function TaskOverview({mine=false}:{mine?:boolean}){
 const counts=await taskOverview(mine);const base=mine?'/dashboard/my-tasks':'/dashboard/tasks';
 return <OverviewCards label={mine?'My task overview':'All task overview'} items={[
 {id:'overdue',label:'Overdue'}, {id:'today',label:'Due today'}, {id:'in_progress',label:'In progress'}, {id:'in_review',label:'Awaiting review'}, {id:'done',label:'Completed'}
 ].map(({id,label})=>({id,label,value:Number(counts[id as keyof typeof counts]),href:`${base}?summary=${id}`,hint:mine?'View my tasks':'View tasks'}))}/>;
}
