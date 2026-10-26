export const landingPages = [
 {value:'/dashboard',label:'Projects'},
 {value:'/dashboard/insights',label:'Dashboard'},
 {value:'/dashboard/my-tasks',label:'My Tasks'},
 {value:'/dashboard/tasks',label:'All Tasks'},
 {value:'/dashboard/calendar',label:'Calendar'},
];
export function validLandingPage(value:unknown):string {
 return landingPages.some(page=>page.value===value)?String(value):'/dashboard';
}
