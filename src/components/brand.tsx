import { Sprout } from "lucide-react";
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-symbol">
        <Sprout size={24} strokeWidth={1.5} />
      </span>
      <span>
        i am able<span className="brand-dot">.</span>
      </span>
    </span>
  );
}
