export function scheduleDates(next:string,frequency:string,anchor:string,end:string|null,limit=5){
 const dates:string[]=[];let date=new Date(next+'T00:00:00Z');const day=new Date(anchor+'T00:00:00Z').getUTCDate();
 if(!Number.isFinite(date.getTime())||!Number.isFinite(day))return dates;
 for(let n=0;n<Math.min(limit,30);n++){const key=date.toISOString().slice(0,10);if(end&&key>end)break;dates.push(key);
 if(frequency==='monthly'){const year=date.getUTCFullYear(),month=date.getUTCMonth()+1;date=new Date(Date.UTC(year,month,Math.min(day,new Date(Date.UTC(year,month+1,0)).getUTCDate())));}
 else date.setUTCDate(date.getUTCDate()+(frequency==='weekly'?7:1));}
 return dates;
}
