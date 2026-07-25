import { SVGAttributes } from "react";

export default function ApplicationLogo(props: SVGAttributes<SVGElement>) {
    return (
        <svg {...props} viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
            <rect
                width="60"
                height="60"
                rx="12"
                fill="var(--color-primary, #E8A817)"
            />
            <text
                x="30"
                y="38"
                textAnchor="middle"
                fill="#1C1815"
                fontFamily="Vazirmatn, sans-serif"
                fontSize="28"
                fontWeight="700"
            >
                TR
            </text>
        </svg>
    );
}
