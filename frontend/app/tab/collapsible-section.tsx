import { memo, useState } from "react";

interface CollapsibleSectionProps {
    title: string;
    count?: number;
    defaultExpanded?: boolean;
    children: React.ReactNode;
}

export const CollapsibleSection = memo(
    ({ title, count, defaultExpanded = true, children }: CollapsibleSectionProps) => {
        const [expanded, setExpanded] = useState(defaultExpanded);
        return (
            <div className="collapsible-section">
                <div className="section-header" role="button" tabIndex={0} onClick={() => setExpanded(!expanded)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(!expanded); } }}>
                    <i className={`fa fa-chevron-${expanded ? "down" : "right"} section-chevron`} />
                    <span className="section-title">{title}</span>
                    {count != null && <span className="section-count">({count})</span>}
                </div>
                {expanded && <div className="section-content">{children}</div>}
            </div>
        );
    }
);
CollapsibleSection.displayName = "CollapsibleSection";
