import Link from 'next/link';
import { ArrowRight, FolderKanban, ListChecks, MessageSquare, Users } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeProvider';

export default function HomePage() {
  return (
    <div className="workspace-home min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-6">
        <Link href="/" className="flex items-center gap-3 font-semibold">
          <FolderKanban className="h-8 w-8 text-blue-500" />
          <span>TaskTracker<span className="block text-xs font-normal text-gray-500">collegedunia.com</span></span>
        </Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-16 pt-16 sm:pt-24">
        <div className="max-w-3xl">
          <p className="mb-5 text-sm font-medium text-blue-500">Central Team Workspace</p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">Great work starts<br />with a clear next step.</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-gray-500">Bring your team’s projects, tasks, and updates together. Know what needs attention and keep every assignment moving forward.</p>
          <Link href="/dashboard" className="mt-8 inline-flex items-center gap-3 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white">Open workspace <ArrowRight className="h-5 w-5" /></Link>
          <p className="mt-3 text-sm text-gray-500">Sign in with your team account to continue.</p>
        </div>
        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {[
            { icon: ListChecks, title: 'Plan with clarity', text: 'Assign tasks, set deadlines, and track progress in board or table view.' },
            { icon: MessageSquare, title: 'Keep context close', text: 'Share remarks, attach supporting files, and follow each task’s history.' },
            { icon: Users, title: 'Move forward together', text: 'Review work, see team workload, and stay on top of approaching deadlines.' },
          ].map(({ icon: Icon, title, text }) => <section key={title} className="rounded-2xl border bg-surface p-6"><Icon className="mb-5 h-6 w-6 text-blue-500" /><h2 className="text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-relaxed text-gray-500">{text}</p></section>)}
        </div>
      </main>
    </div>
  );
}
