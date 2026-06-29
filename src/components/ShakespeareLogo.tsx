export interface ShakespeareLogoProps {
  className?: string;
}

/** App icon for Marlowe. Named ShakespeareLogo for backwards compatibility. */
export function ShakespeareLogo({ className }: ShakespeareLogoProps) {
  return (
    <img
      src="/marlowe.svg"
      alt="Marlowe"
      className={className}
    />
  );
}
