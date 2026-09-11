// This adapter implements only the query operations used by this app. No SQL or
// query syntax is accepted from an HTTP client; values always use parameters.
import type { PoolClient } from 'pg';
export type Run = <T>(work: (db: PoolClient) => Promise<T>) => Promise<T>;
const tables = new Set(['profiles','projects','project_members','tasks','project_notes','task_comments','notifications','task_checklist','task_history','task_dependencies','task_attachments']);
const id = (value: string) => { if (!/^[a-z_][a-z_0-9]*$/.test(value)) throw new Error('Invalid query identifier'); return `"${value}"`; };
type Relation = [string, string, string, boolean];
const relations: Record<string, Record<string, Relation>> = {
  projects: { project_members:['project_members','id','project_id',true], tasks:['tasks','id','project_id',true] },
  project_members: { profiles:['profiles','user_id','id',false] },
  tasks: { profiles:['profiles','assignee_id','id',false], projects:['projects','project_id','id',false], task_comments:['task_comments','id','task_id',true] },
  project_notes: { profiles:['profiles','author_id','id',false] },
  task_comments: { profiles:['profiles','author_id','id',false] },
  task_history: { profiles:['profiles','actor_id','id',false] },
  notifications: { tasks:['tasks','task_id','id',false] },
};
export function splitProjection(value: string) {
  const fields: string[] = []; let start=0, depth=0;
  for(let n=0;n<value.length;n++) {
    if(value[n]==='(')depth++;
    if(value[n]===')')depth--;
    if(depth<0)throw new Error('Invalid projection');
    if(value[n]===',' && depth===0){fields.push(value.slice(start,n).trim());start=n+1;}
  }
  if(depth!==0)throw new Error('Invalid projection');
  fields.push(value.slice(start).trim()); return fields;
}
function projection(table: string, fields: string, alias: string, depth=0): string {
  if(depth>4)throw new Error('Projection nesting exceeded');
  const parts: string[]=[];
  for(const field of splitProjection(fields)) {
    if(field==='*') {parts.push(`to_jsonb(${alias})`);continue;}
    const match=field.match(/^(?:(\w+):)?(\w+)(?:!(\w+))?\(([\s\S]*)\)$/);
    if(match) {
      const [,rename,related,,inner]=match;
      const rel=relations[table]?.[related];if(!rel)throw new Error('Unsupported relationship');
      const [target,local,remote,many]=rel, child=`r${depth+1}`;
      const where=`${child}.${id(remote)}=${alias}.${id(local)}`;
      const expr=inner.trim()==='count'
        ? `(SELECT jsonb_build_array(jsonb_build_object('count',count(*))) FROM public.${id(target)} ${child} WHERE ${where})`
        : many
          ? `(SELECT coalesce(jsonb_agg(${projection(target,inner,child,depth+1)}),'[]'::jsonb) FROM public.${id(target)} ${child} WHERE ${where})`
          : `(SELECT ${projection(target,inner,child,depth+1)} FROM public.${id(target)} ${child} WHERE ${where})`;
      id(rename || related);parts.push(`jsonb_build_object('${rename || related}',${expr})`);
    } else {
      id(field);parts.push(`jsonb_build_object('${field}',${alias}.${id(field)})`);
    }
  }
  return parts.join(' || ');
}
export class Query implements PromiseLike<unknown> {
  private fields='*'; private operation='select'; private values: Record<string,unknown> = {};
  private filters: [string,unknown][]=[];private sort?: [string,boolean,boolean];private maximum?: number;
  private cardinality='many';private head=false;private count=false;private returning=false;
  constructor(private table: string,private run: Run){if(!tables.has(table))throw new Error('Unsupported table');}
  select(fields='*',options?: {head?:boolean;count?:string}) {this.fields=fields.replace(/\s+/g,' ').trim();this.head=!!options?.head;this.count=!!options?.count;this.returning=true;return this;}
  eq(column:string,value:unknown){this.filters.push([column,value]);return this;}
  order(column:string,options?:{ascending?:boolean;nullsFirst?:boolean}){this.sort=[column,options?.ascending!==false,options?.nullsFirst===true];return this;}
  limit(n:number){if(!Number.isInteger(n)||n<0||n>10000)throw new Error('Invalid limit');this.maximum=n;return this;}
  single(){this.cardinality='one';return this;}
  maybeSingle(){this.cardinality='optional';return this;}
  insert(values:Record<string,unknown>){this.operation='insert';this.values=values;return this;}
  update(values:Record<string,unknown>){this.operation='update';this.values=values;return this;}
  upsert(values:Record<string,unknown>,options:{onConflict:string}){if(options.onConflict!=='id')throw new Error('Unsupported conflict target');this.operation='upsert';this.values=values;return this;}
  delete(){this.operation='delete';return this;}
  async execute() {
    try {return await this.run(async db=>{
      const args: unknown[]=[];const bind=(v:unknown)=>{args.push(v===undefined?null:v);return `$${args.length}`;};
      const where=this.filters.map(([column,value])=>{
        if(column==='project.is_archived' && this.table==='tasks')return `EXISTS(SELECT 1 FROM public.projects filter_project WHERE filter_project.id=t.project_id AND filter_project.is_archived=${bind(value)})`;
        return `t.${id(column)}=${bind(value)}`;
      });
      const clause=where.length?` WHERE ${where.join(' AND ')}`:'';
      let source=`public.${id(this.table)}`,prefix='';
      if(this.operation!=='select') {
        if(['update','delete'].includes(this.operation)&&!where.length)throw new Error('A mutation must have a filter');
        const cols=Object.keys(this.values);const quoted=cols.map(id);
        let sql='';
        if(this.operation==='insert'||this.operation==='upsert') {
          if(!cols.length)throw new Error('Empty insert');
          sql=`INSERT INTO ${source} (${quoted}) VALUES (${cols.map(c=>bind(this.values[c]))})`;
          if(this.operation==='upsert')sql+=` ON CONFLICT(id) DO UPDATE SET ${quoted.filter(c=>c!=='"id"').map(c=>`${c}=excluded.${c}`).join(',')}`;
        } else if(this.operation==='update') {
          if(!cols.length)throw new Error('Empty update');
          sql=`UPDATE ${source} t SET ${cols.map(c=>`${id(c)}=${bind(this.values[c])}`).join(',')}${clause}`;
        } else sql=`DELETE FROM ${source} t${clause}`;
        prefix=`WITH changed AS (${sql} RETURNING *) `;source='changed';
      }
      const result=await db.query(`${prefix}SELECT ${projection(this.table,this.fields,'t')} AS row FROM ${source} t${this.operation==='select'?clause:''}${this.sort?` ORDER BY t.${id(this.sort[0])} ${this.sort[1]?'ASC':'DESC'} NULLS ${this.sort[2]?'FIRST':'LAST'}`:''}${this.maximum!==undefined?` LIMIT ${this.maximum}`:''}`,args);
      const rows=result.rows.map(r=>r.row);
      if(this.cardinality==='one'&&rows.length!==1 || this.cardinality==='optional'&&rows.length>1)throw new Error('Record not found or access denied.');
      return {data:this.head||this.operation!=='select'&&!this.returning?null:this.cardinality==='many'?rows:rows[0]||null,error:null,count:this.count?rows.length:null};
    });} catch(error) {return {data:null,error:{message:error instanceof Error?error.message:'Database operation failed.'},count:null};}
  }
  then<TResult1=unknown,TResult2=never>(resolve?:((value:unknown)=>TResult1|PromiseLike<TResult1>)|null,reject?:((reason:unknown)=>TResult2|PromiseLike<TResult2>)|null):Promise<TResult1|TResult2>{return this.execute().then(resolve,reject);}
}
