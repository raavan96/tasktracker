import {planningOptions} from '@/lib/planning';
import TemplateLibrary from './TemplateLibrary';
export default async function TemplatesPage(){return <TemplateLibrary options={await planningOptions()}/>;}
