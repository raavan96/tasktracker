import {redirect} from 'next/navigation';
// Old bookmarks lead to the active workspace; saved records are left intact.
export default function TemplatesPage(){redirect('/dashboard');}
