import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { codeToHtml } from "shiki";

function CodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [html, setHtml] = useState<string>();
  const code = String(children ?? "").replace(/\n$/, "");
  const language = className?.replace("language-", "") || "text";

  useEffect(() => {
    let active = true;
    codeToHtml(code, {
      lang: language,
      theme: "github-dark"
    })
      .then((value) => {
        if (active) setHtml(value);
      })
      .catch(() => {
        if (active) setHtml(undefined);
      });
    return () => {
      active = false;
    };
  }, [code, language]);

  if (html) {
    return <div className="overflow-auto rounded border border-border bg-[#0b0d0f] text-xs" dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return (
    <pre className="overflow-auto rounded border border-border bg-[#0b0d0f] p-3 text-xs">
      <code>{code}</code>
    </pre>
  );
}

export function AnswerMarkdown({ content }: { content: string }) {
  return (
    <div className="prose prose-invert max-w-none text-sm prose-p:leading-6 prose-pre:bg-transparent prose-pre:p-0">
      <ReactMarkdown
        components={{
          code(props) {
            const { children, className } = props;
            return className ? <CodeBlock className={className}>{children}</CodeBlock> : <code>{children}</code>;
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
