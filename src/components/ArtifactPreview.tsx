import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";

interface ArtifactPreviewProps {
  content: string;
  language?: string;
}

export default function ArtifactPreview({ content, language }: ArtifactPreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const mdContent = language ? `\`\`\`${language}\n${content}\n\`\`\`` : content;

  return (
    <div className="artifact-preview">
      <div className="artifact-header">
        <span>프리뷰{language ? ` · ${language}` : ""}</span>
        <button className="artifact-copy-btn" onClick={handleCopy}>
          {copied ? "복사됨 ✓" : "복사"}
        </button>
      </div>
      <div className="artifact-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
          {mdContent}
        </ReactMarkdown>
      </div>
    </div>
  );
}
