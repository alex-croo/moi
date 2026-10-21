import { Sprout } from "lucide-react";
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-symbol">
        <Sprout size={24} strokeWidth={1.5} />
      </span>
      <span className="brand-name">
        Tred<span className="brand-dot">’</span>meal
        <small>by Croo.Studio</small>
      </span>
    </span>
  );
}
