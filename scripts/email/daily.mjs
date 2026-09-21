import {renderEmail,escapeHtml as esc} from './templates.mjs';
export async function dailyBriefingData(db,userId,date){
 const {rows}=await db.query(`WITH scope AS (
 SELECT t.id,t.project_id,t.title,t.status,t.due_date::text,p.name project_name,
 CASE WHEN $1=ANY(t.assignee_ids) THEN 'assigned' ELSE 'delegated' END section,
 (SELECT string_agg(coalesce(u.full_name,u.email),', ' ORDER BY u.full_name,u.id) FROM profiles u WHERE u.id=ANY(t.assignee_ids)) assignees
 FROM tasks t JOIN projects p ON p.id=t.project_id
 WHERE ($1=ANY(t.assignee_ids) OR (t.created_by=$1 AND cardinality(t.assignee_ids)>0))
 AND t.status NOT IN ('done','in_review') AND t.due_date<=$2::date+1 AND can_email_task($1,t.id)
 ), ranked AS (
 SELECT *,row_number() OVER(PARTITION BY section ORDER BY due_date,id) rn,
 count(*) OVER(PARTITION BY section)::int section_total,
 count(*) FILTER(WHERE due_date<$2::text) OVER()::int overdue,
 count(*) FILTER(WHERE due_date=$2::text) OVER()::int today,
 count(*) FILTER(WHERE due_date=($2::date+1)::text) OVER()::int tomorrow
 FROM scope) SELECT * FROM ranked WHERE rn<=20 ORDER BY section,due_date,id`,[userId,date]);
 if(!rows.length)return null;
 return {period:date,stats:[['Overdue',rows[0].overdue],['Due today',rows[0].today],['Tomorrow',rows[0].tomorrow]],sections:['assigned','delegated'].map(section=>{
  const items=rows.filter(r=>r.section===section).map(r=>{const days=Math.round((Date.parse(r.due_date)-Date.parse(date))/86400000);return {...r,due:days<0?`${-days} day${days===-1?'':'s'} overdue`:days===0?'Due today':'Due tomorrow'};});
  return {title:section==='assigned'?'Assigned to you':'Delegated by you',total:items[0]?.section_total||0,items};
 })};
}
export function renderDailyBriefing(data){
 const base='https://tasktracker.top-menus.com';
 const taskUrl=t=>`${base}/dashboard/projects/${encodeURIComponent(t.project_id)}?task=${encodeURIComponent(t.id)}`;
 const mail=renderEmail('deadline_digest',{name:data.name,period:data.period});
 const summary=`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0"><tr>${data.stats.map(([label,value],i)=>`<td width="33%" style="padding:14px 8px;background:#172436;border-bottom:2px solid ${['#f5a6b6','#f2cc8b','#9ddfe9'][i]}"><strong style="font-size:27px;color:#f1f6fd">${value}</strong><br><span style="font-size:12px;color:#d0dbe8">${label}</span></td>`).join('')}</tr></table>`;
 const sections=data.sections.map(s=>`<h2 style="margin:30px 0 10px;font-size:20px;color:#f1f6fd">${s.title} · ${s.total} tasks</h2>${s.items.length?s.items.map(t=>`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:12px 0;background:#172436;border:1px solid #314259;border-radius:10px"><tr><td style="padding:17px"><p style="margin:0 0 10px;color:${t.due.includes('overdue')?'#f5a6b6':'#f2cc8b'};font-size:12px;font-weight:bold">${esc(t.due)} · ${esc(t.due_date)}</p><a href="${esc(taskUrl(t))}" style="color:#f1f6fd;font-size:16px;line-height:23px;font-weight:bold">${esc(t.title)} ↗</a><p style="margin:8px 0;color:#bbc9da;font-size:13px;line-height:21px">${esc(t.project_name)}<br>Assigned to: ${esc(t.assignees||'Unassigned')} · ${esc(t.status.replaceAll('_',' '))}</p></td></tr></table>`).join(''):'<p style="color:#bbc9da;font-size:14px">Nothing due in this section.</p>'}${s.total>s.items.length?`<p style="color:#bbc9da">${s.total-s.items.length} more tasks — <a style="color:#8fe2ee" href="${base}/dashboard/${s.title==='Assigned to you'?'my-tasks':'tasks?preset=delegated'}">view in TaskTracker</a>.</p>`:''}`).join('');
 mail.html=mail.html.replace('Here are your overdue tasks and work due today or tomorrow. This summary covers work currently assigned to you.','Your 11 AM task briefing: what needs your attention today, what is coming tomorrow, and work to follow up with your team.').replace('<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:26px">',summary+sections+'<p style="color:#acbbcf;font-size:12px;line-height:20px">Each task appears once. Completed, archived and awaiting-review work is excluded. Dates use India time.</p><table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:26px">').replace('Manage email preferences','Open notifications');
 mail.subject=`TaskTracker daily briefing — ${data.period} · ${data.stats.map(([label,n])=>`${n} ${label.toLowerCase()}`).join(', ')}`;
 mail.text=[mail.subject,`Hi ${data.name||'there'},`,...data.sections.flatMap(s=>[`${s.title}: ${s.total} tasks`,...s.items.map(t=>`${t.title} — ${t.due} (${t.due_date})\n${t.project_name} · Assigned to: ${t.assignees}\n${taskUrl(t)}`),s.total>s.items.length?`${s.total-s.items.length} more tasks in the app.`:'']),`Open TaskTracker: ${base}/dashboard/my-tasks`].filter(Boolean).join('\n\n');
 return mail;
}
