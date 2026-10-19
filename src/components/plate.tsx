export function Plate({
  kind = "bowl",
  large = false,
}: {
  kind?: string;
  large?: boolean;
}) {
  return (
    <svg
      className={`plate-art ${large ? "large" : ""}`}
      viewBox="0 0 360 280"
      fill="none"
      aria-hidden="true"
    >
      <ellipse
        cx="188"
        cy="246"
        rx="117"
        ry="15"
        fill="#294E3D"
        opacity=".09"
      />
      <path
        d="M51 217C63 183 52 129 31 96M47 180C15 170 14 145 14 145C42 146 50 166 47 180M48 151C72 130 72 107 72 107C44 117 43 137 48 151M36 118C13 110 8 88 8 88C29 87 38 106 36 118"
        stroke="#768B61"
        strokeWidth="3"
        fill="#8B9F77"
      />
      <circle cx="187" cy="139" r="113" fill="#D9D7BC" />
      <circle cx="183" cy="133" r="113" fill="#FFFDF6" />
      <circle cx="183" cy="133" r="96" fill="#ECEBD9" stroke="#E3E1CD" />
      <circle cx="183" cy="133" r="85" fill="#F1DEAD" />
      {Array.from({ length: 25 }, (_, i) => (
        <path
          key={i}
          d={`M${120 + (i % 5) * 19} ${76 + Math.floor(i / 5) * 23}l9 5`}
          stroke="#FFFAE8"
          strokeWidth="5"
          strokeLinecap="round"
        />
      ))}
      <g fill="#648050" stroke="#536D40" strokeWidth="1.2">
        <ellipse
          cx="131"
          cy="87"
          rx="29"
          ry="17"
          transform="rotate(-28 131 87)"
        />
        <ellipse
          cx="110"
          cy="113"
          rx="27"
          ry="17"
          transform="rotate(-50 110 113)"
        />
        <ellipse
          cx="113"
          cy="143"
          rx="30"
          ry="16"
          transform="rotate(-72 113 143)"
        />
        <ellipse
          cx="132"
          cy="165"
          rx="28"
          ry="17"
          transform="rotate(-12 132 165)"
        />
      </g>
      {kind === "salmon" ? (
        <g transform="rotate(-25 196 123)">
          <rect x="155" y="85" width="86" height="67" rx="20" fill="#D99471" />
          <path
            d="M170 88l10 61m10-63 10 66m10-64 11 58"
            stroke="#F4C2A4"
            strokeWidth="5"
          />
        </g>
      ) : kind === "pasta" ? (
        <g stroke="#D9B04D" strokeWidth="12" strokeLinecap="round">
          <path d="M173 92q35 18 26 44M204 80q24 24 12 44M153 112q32 12 30 43M224 124q15 23-3 43" />
        </g>
      ) : kind === "taco" ? (
        <g>
          <path d="M145 95q64-55 103 48l-87 41q-37-42-16-89" fill="#E8C572" />
          <path d="M161 100q45-23 64 43l-55 23q-22-41-9-66" fill="#94663E" />
          <path
            d="M168 113l33 11-23 26m29-12 13 9"
            stroke="#65874C"
            strokeWidth="10"
          />
        </g>
      ) : (
        <g
          transform="rotate(-25 196 123)"
          fill="#CFA16A"
          stroke="#B28049"
          strokeWidth="1"
        >
          <rect x="155" y="85" width="20" height="77" rx="8" />
          <rect x="179" y="80" width="20" height="82" rx="8" />
          <rect x="203" y="83" width="20" height="74" rx="8" />
          <path
            d="M159 100h12m-12 13h12m12-20h12m-12 20h12m12-13h12"
            stroke="#9A693E"
            strokeWidth="2"
          />
        </g>
      )}
      <g fill="#B85E40">
        <circle cx="220" cy="176" r="15" />
        <circle cx="244" cy="156" r="13" />
        <circle cx="193" cy="191" r="12" />
      </g>
      <g fill="#E89A78">
        <circle cx="220" cy="176" r="8" />
        <circle cx="244" cy="156" r="6" />
        <circle cx="193" cy="191" r="6" />
      </g>
      <path d="M145 185q14 29 49 25l-7-34z" fill="#69854B" />
      <path d="M151 187q15 19 35 17l-3-21z" fill="#C7CF7A" />
      <path
        d="M241 75a28 28 0 0 1 18 40l-29-9z"
        fill="#E5CF6A"
        stroke="#FFF1A6"
        strokeWidth="5"
      />
      <g fill="#416D47">
        <ellipse
          cx="181"
          cy="133"
          rx="9"
          ry="4"
          transform="rotate(-30 181 133)"
        />
        <ellipse
          cx="166"
          cy="163"
          rx="7"
          ry="4"
          transform="rotate(30 166 163)"
        />
        <ellipse
          cx="208"
          cy="100"
          rx="8"
          ry="3"
          transform="rotate(-50 208 100)"
        />
      </g>
      <path
        d="M313 63v127m-9-127v31q9 13 18 0V63m-9 115v61"
        stroke="#9B9B7D"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="74" cy="224" r="17" fill="#E6CFC0" />
      <path d="M64 223l17-1m-9-8 1 18" stroke="#F8EEE2" strokeWidth="2" />
    </svg>
  );
}
