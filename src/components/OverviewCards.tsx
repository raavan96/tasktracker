import Link from 'next/link';
export type OverviewItem={id:string;label:string;value:number;href:string;hint:string};
export default function OverviewCards({label,items}:{label:string;items:OverviewItem[]}){
 return <section aria-label={label} className={`overview-cards grid grid-cols-2 gap-3 ${items.length===3?'lg:grid-cols-3':'lg:grid-cols-5'}`}>
 {items.map(item=><Link key={item.id} href={item.href} data-summary={item.id} className="summary-card rounded-xl border border-gray-200 bg-surface p-5 hover:border-blue-400 transition"><p className="text-sm text-gray-600">{item.label}</p><p className="mt-2 text-3xl font-semibold tracking-tight">{item.value}</p><p className="mt-2 text-xs text-gray-500">{item.hint} →</p></Link>)}
 </section>;
}
