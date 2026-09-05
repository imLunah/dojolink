import ReactMarkdown from 'react-markdown';
import '../../styles/markdown.css';

// Renders a stored markdown note/log. Plain text (old notes with no markdown)
// renders unchanged, so this is safe to drop in anywhere notes are displayed.
const COMPONENTS = {
  a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer" className="text-ninja-blue underline underline-offset-2 hover:text-ninja-blue-hover">{children}</a>,
  h1: ({ children }) => <p className="font-bold">{children}</p>,
  h2: ({ children }) => <p className="font-bold">{children}</p>,
  h3: ({ children }) => <p className="font-bold">{children}</p>,
};

export default function MarkdownView({ children, className = '' }) {
  return (
    <div className={`md-view ${className}`}>
      <ReactMarkdown
        components={COMPONENTS}
        urlTransform={(url) => (/^(https?:|mailto:)/i.test(url) ? url : '')}
      >
        {children || ''}
      </ReactMarkdown>
    </div>
  );
}
