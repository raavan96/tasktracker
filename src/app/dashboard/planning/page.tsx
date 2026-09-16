import WorkspaceHeading from '@/components/WorkspaceHeading';
import Link from 'next/link';
import {planningOptions,previewPlanning} from '@/lib/planning';
import type {PlanningSource} from '@/lib/planning-types';
import PlanningForm from './PlanningForm';
export default async function PlanningPage({searchParams}:{searchParams:Promise<{kind?:string;id?:string;save?:string}>}){
 const params=await searchParams;const options=await planningOptions();
 let preview;try{preview=await previewPlanning({kind:params.kind as PlanningSource['kind'],id:params.id||''});}catch(error){return <section className="space-y-4"><WorkspaceHeading className="text-2xl font-bold">Plan new work</WorkspaceHeading><p role="alert">{error instanceof Error?error.message:'Preview unavailable.'}</p><Link className="text-blue-600 underline" href="/dashboard/templates">Go to templates</Link></section>;}
 return <PlanningForm key={preview.version} preview={preview} options={options} saveFirst={params.save==='true'}/>;
}
