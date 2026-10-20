import { Sprout } from "lucide-react";
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-symbol">
        <Sprout size={24} strokeWidth={1.5} />
      </span>
      <span className="brand-name">
        i am able<span className="brand-dot">.</span>
        <small>by Croo.Studio</small>
      </span>
    </span>
  );
}
