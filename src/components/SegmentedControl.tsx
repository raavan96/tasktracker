'use client';
import type {ReactNode} from 'react';
export default function SegmentedControl({label,value,onChange,options}:{label:string;value:string;onChange:(value:string)=>void;options:{value:string;label:string;icon?:ReactNode}[]}){
 const index=Math.max(0,options.findIndex(o=>o.value===value));
 return <div role="group" aria-label={label} className="compact-segmented" style={{gridTemplateColumns:`repeat(${options.length},minmax(0,1fr))`}}><span aria-hidden="true" className="compact-segmented-indicator" style={{width:`calc((100% - 8px) / ${options.length})`,transform:`translateX(${index*100}%)`}}/>{options.map(o=><button key={o.value} type="button" aria-pressed={value===o.value} onClick={()=>onChange(o.value)}>{o.icon}{o.label}</button>)}</div>;
}
