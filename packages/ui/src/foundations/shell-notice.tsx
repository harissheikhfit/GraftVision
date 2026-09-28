export interface ShellNoticeProps {
  readonly label: string;
  readonly message: string;
  readonly title: string;
}

export function ShellNotice({ label, message, title }: ShellNoticeProps) {
  return (
    <main className="shell-notice" id="main-content" tabIndex={-1}>
      <p className="shell-notice__label">{label}</p>
      <h1>{title}</h1>
      <p>{message}</p>
    </main>
  );
}
