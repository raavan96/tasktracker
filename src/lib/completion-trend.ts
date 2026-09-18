/** Fill Monday-based weekly buckets, clipping labels to the selected month. */
export function completionWeeks(month: string, events: {week:string;count:number}[]) {
 const first = new Date(month + '-01T12:00:00Z');
 const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth()+1, 0, 12));
 const cursor = new Date(first);
 cursor.setUTCDate(cursor.getUTCDate() - (cursor.getUTCDay()+6)%7);
 const counts = new Map(events.map(event => [event.week, event.count]));
 const result: {week:string;start:string;end:string;count:number}[] = [];
 while (cursor <= last) {
  const week = cursor.toISOString().slice(0,10);
  const end = new Date(cursor); end.setUTCDate(end.getUTCDate()+6);
  result.push({week, start:new Date(Math.max(+first,+cursor)).toISOString().slice(0,10), end:new Date(Math.min(+last,+end)).toISOString().slice(0,10), count:counts.get(week)||0});
  cursor.setUTCDate(cursor.getUTCDate()+7);
 }
 return result;
}
