export interface SkipNavigationProps {
  readonly label?: string;
  readonly targetId?: string;
}

export function SkipNavigation({
  label = "Skip to main content",
  targetId = "main-content",
}: SkipNavigationProps) {
  return (
    <a className="gv-skip-navigation" href={`#${targetId}`}>
      {label}
    </a>
  );
}
