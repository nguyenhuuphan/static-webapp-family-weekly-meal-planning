import { useI18n } from "src/i18n";
const TableIllustration: React.FC = () => {
  const { t: tr } = useI18n();
  return (
    <div className="table-art" aria-hidden="true">
      <svg className="table-scene" viewBox="0 0 420 340" fill="none">
        <defs>
          <pattern
            id="table-check"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <path d="M0 0H24V24H0Z" fill="#E9A66F" />
            <path
              d="M0 6H24M6 0V24"
              stroke="#FFE5BD"
              strokeWidth="8"
              opacity=".65"
            />
          </pattern>
          <filter id="dish-shadow" x="-30%" y="-30%" width="160%" height="170%">
            <feDropShadow
              dx="0"
              dy="12"
              stdDeviation="12"
              floodColor="#805717"
              floodOpacity=".18"
            />
          </filter>
        </defs>
        <circle cx="220" cy="172" r="146" fill="#FFF7D9" opacity=".7" />
        <rect
          x="103"
          y="54"
          width="215"
          height="236"
          rx="12"
          fill="url(#table-check)"
          transform="rotate(-14 210 170)"
        />
        <g filter="url(#dish-shadow)">
          <circle cx="213" cy="170" r="113" fill="#FFFEF8" />
          <circle cx="213" cy="170" r="91" stroke="#E9DFC7" strokeWidth="2" />
        </g>
        <g fill="#567A46">
          <ellipse
            cx="177"
            cy="142"
            rx="26"
            ry="15"
            transform="rotate(-38 177 142)"
          />
          <ellipse
            cx="215"
            cy="121"
            rx="28"
            ry="15"
            transform="rotate(25 215 121)"
          />
          <ellipse
            cx="248"
            cy="143"
            rx="29"
            ry="15"
            transform="rotate(-25 248 143)"
          />
          <ellipse
            cx="255"
            cy="184"
            rx="25"
            ry="17"
            transform="rotate(45 255 184)"
          />
          <ellipse
            cx="216"
            cy="209"
            rx="28"
            ry="15"
            transform="rotate(-15 216 209)"
          />
          <ellipse
            cx="173"
            cy="192"
            rx="28"
            ry="17"
            transform="rotate(35 173 192)"
          />
        </g>
        <g fill="#87A861">
          <ellipse
            cx="188"
            cy="120"
            rx="13"
            ry="22"
            transform="rotate(-20 188 120)"
          />
          <ellipse
            cx="266"
            cy="161"
            rx="13"
            ry="22"
            transform="rotate(30 266 161)"
          />
          <ellipse
            cx="187"
            cy="212"
            rx="13"
            ry="22"
            transform="rotate(50 187 212)"
          />
        </g>
        <g transform="rotate(-20 212 167)">
          <rect x="184" y="134" width="62" height="63" rx="16" fill="#D68B49" />
          <path
            d="M196 143V188M211 140V190M226 144V187"
            stroke="#9B592E"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
        <g fill="#DD7254" stroke="#BF5940" strokeWidth="2">
          <circle cx="164" cy="163" r="12" />
          <circle cx="239" cy="211" r="12" />
          <circle cx="250" cy="126" r="10" />
        </g>
        <g fill="#FFF0C1">
          <path d="M157 199L173 185L183 202Z" />
          <path d="M226 116L237 132L217 134Z" />
          <path d="M253 170L267 187L246 192Z" />
        </g>
        <g stroke="#9A8663" strokeWidth="5" strokeLinecap="round">
          <path d="M352 106V233M341 91V121Q352 135 363 121V91M352 91V124" />
          <path d="M77 117V236M77 91Q58 117 77 150" />
        </g>
        <g transform="translate(304 246)">
          <circle r="31" fill="#F8CF64" />
          <circle r="24" fill="#FFEAAA" />
          <path
            d="M0 0V-21M0 0L20-7M0 0L12 17M0 0L-12 17M0 0L-20-7"
            stroke="#EAB947"
            strokeWidth="2"
          />
        </g>
        <path d="M99 52Q123 32 131 54Q111 70 99 52Z" fill="#63854F" />
        <path d="M83 63Q88 38 103 48Q104 68 83 63Z" fill="#8AA46A" />
        <circle cx="337" cy="64" r="5" fill="#D49C34" />
        <circle cx="64" cy="190" r="4" fill="#D49C34" />
      </svg>
      <span className="art-caption">{tr("aLittleHomemadeHappiness")}</span>
    </div>
  );
};
export default TableIllustration;
