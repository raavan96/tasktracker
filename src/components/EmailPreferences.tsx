export default function EmailPreferences({deliveryEnabled}:{deliveryEnabled:boolean}){
 return <section className="mt-4 rounded-xl border bg-surface p-4" aria-label="Workspace email notifications">
 <h2 className="text-sm font-medium">Email notifications</h2>
 <p className="mt-2 text-sm text-gray-600">{deliveryEnabled?'Email notifications are enabled for all active team members and managed by the workspace.':'Workspace email delivery is currently paused.'}</p>
 <p className="mt-2 text-sm leading-6 text-gray-600">You receive task assignments, mentions, review updates, daily briefings for assigned and delegated tasks from 11 AM IST, and your weekly task and project report on Mondays from 11 AM IST.</p>
 <p className="mt-2 text-xs leading-5 text-gray-500">In-app alert preferences are separate. Open the task to reply; email replies do not update it.</p>
 </section>;
}
