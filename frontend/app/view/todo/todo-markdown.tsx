import * as React from "react";

/**
 * Renders inline markdown (bold, italic, code, links) as React nodes.
 * Handles: **bold**, *italic*, `code`, [text](url)
 */
export function renderInlineMarkdown(text: string): React.ReactNode {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
        const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
        if (linkMatch) {
            parts.push(
                <a key={key++} href={linkMatch[2]} onClick={(e) => e.preventDefault()} title={linkMatch[2]}>
                    {linkMatch[1]}
                </a>
            );
            remaining = remaining.slice(linkMatch[0].length);
            continue;
        }
        const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
        if (boldMatch) {
            parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
            remaining = remaining.slice(boldMatch[0].length);
            continue;
        }
        const italicMatch = remaining.match(/^\*([^*\s][^*]*[^*\s]|[^*\s])\*/);
        if (italicMatch) {
            parts.push(<em key={key++}>{italicMatch[1]}</em>);
            remaining = remaining.slice(italicMatch[0].length);
            continue;
        }
        const codeMatch = remaining.match(/^`([^`]+)`/);
        if (codeMatch) {
            parts.push(<code key={key++}>{codeMatch[1]}</code>);
            remaining = remaining.slice(codeMatch[0].length);
            continue;
        }
        const nextSpecial = remaining.search(/\*\*|\*|`|\[/);
        if (nextSpecial === -1) {
            parts.push(remaining);
            remaining = "";
        } else if (nextSpecial === 0) {
            parts.push(remaining[0]);
            remaining = remaining.slice(1);
        } else {
            parts.push(remaining.slice(0, nextSpecial));
            remaining = remaining.slice(nextSpecial);
        }
    }

    return <>{parts}</>;
}
