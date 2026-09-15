'use client';
export default function TaskSection({name,count,canAdd,children}:{name:string;count:number;canAdd:boolean;children:React.ReactNode}){
 if(!count&&!canAdd)return null;
 return <details open={count>0||undefined} className="rounded-xl border p-4"><summary className="cursor-pointer font-medium">{count?`${name} (${count})`:`Add ${name.toLowerCase()}`}</summary><div className="mt-4 space-y-3">{children}</div></details>;
}
