import React from 'react';

export interface AppLogoMarkProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

/**
 * TaskTracker vector logo mark representing agile task boards,
 * layered progression, and validated task completion.
 */
export function AppLogoMark({
  className = 'w-5 h-5',
  size,
  ...props
}: AppLogoMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      {...props}
    >
      <rect x="3.5" y="3.5" width="6.5" height="9" rx="1.75" />
      <rect x="13.5" y="3.5" width="7" height="6" rx="1.75" opacity="0.75" />
      <rect x="3.5" y="15" width="6.5" height="5.5" rx="1.75" opacity="0.6" />
      <path d="M13 14.5L15.5 17.5L20.5 11.5" strokeWidth="2.4" />
    </svg>
  );
}

export default AppLogoMark;
