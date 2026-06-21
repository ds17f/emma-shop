"use client";

/**
 * A form submit button that asks for confirmation first. Drop inside any
 * <form action={serverAction}> — if the user cancels, the submit is blocked.
 */
export function ConfirmButton({
  message,
  children,
  className,
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
