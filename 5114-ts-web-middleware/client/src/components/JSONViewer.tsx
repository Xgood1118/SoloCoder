import React, { useState } from 'react';

interface JSONViewerProps {
  data: any;
  highlightPaths?: string[];
  initialExpanded?: boolean;
}

const JSONViewer: React.FC<JSONViewerProps> = ({ data, highlightPaths = [], initialExpanded = true }) => {
  return (
    <div className="response-text">
      <JSONNode data={data} path="$" highlightPaths={highlightPaths} initialExpanded={initialExpanded} />
    </div>
  );
};

interface JSONNodeProps {
  data: any;
  path: string;
  highlightPaths: string[];
  initialExpanded: boolean;
  indent?: number;
}

const JSONNode: React.FC<JSONNodeProps> = ({
  data,
  path,
  highlightPaths,
  initialExpanded,
  indent = 0,
}) => {
  const [expanded, setExpanded] = useState(initialExpanded);
  const isHighlighted = highlightPaths.includes(path);

  const renderValue = () => {
    if (data === null) {
      return <span className="json-null">null</span>;
    }

    if (typeof data === 'boolean') {
      return <span className="json-boolean">{data.toString()}</span>;
    }

    if (typeof data === 'number') {
      return <span className="json-number">{data}</span>;
    }

    if (typeof data === 'string') {
      return <span className="json-string">"{data}"</span>;
    }

    if (Array.isArray(data)) {
      if (data.length === 0) {
        return <span className="json-bracket">[]</span>;
      }
      return (
        <>
          <span className="json-bracket">[</span>
          {expanded ? (
            <>
              {data.map((item, index) => (
                <div key={index} style={{ marginLeft: (indent + 1) * 16 }}>
                  <JSONNode
                    data={item}
                    path={`${path}[${index}]`}
                    highlightPaths={highlightPaths}
                    initialExpanded={initialExpanded}
                    indent={indent + 1}
                  />
                  {index < data.length - 1 && <span className="json-bracket">,</span>}
                </div>
              ))}
              <div style={{ marginLeft: indent * 16 }}>
                <span className="json-bracket">]</span>
              </div>
            </>
          ) : (
            <span className="json-bracket"> ... {data.length} items ]</span>
          )}
        </>
      );
    }

    if (typeof data === 'object') {
      const keys = Object.keys(data);
      if (keys.length === 0) {
        return <span className="json-bracket">{'{}'}</span>;
      }
      return (
        <>
          <span className="json-bracket">{'{'}</span>
          {expanded ? (
            <>
              {keys.map((key, index) => (
                <div key={key} style={{ marginLeft: (indent + 1) * 16 }}>
                  <span className="json-key">"{key}"</span>
                  <span className="json-bracket">: </span>
                  <JSONNode
                    data={data[key]}
                    path={`${path}.${key}`}
                    highlightPaths={highlightPaths}
                    initialExpanded={initialExpanded}
                    indent={indent + 1}
                  />
                  {index < keys.length - 1 && <span className="json-bracket">,</span>}
                </div>
              ))}
              <div style={{ marginLeft: indent * 16 }}>
                <span className="json-bracket">{'}'}</span>
              </div>
            </>
          ) : (
            <span className="json-bracket"> ... {keys.length} keys {'}'}</span>
          )}
        </>
      );
    }

    return <span>{String(data)}</span>;
  };

  const isExpandable = Array.isArray(data) || (typeof data === 'object' && data !== null);

  return (
    <span className={isHighlighted ? 'highlight-match' : ''}>
      {isExpandable && (
        <span className="collapse-btn" onClick={() => setExpanded(!expanded)}>
          {expanded ? '▼' : '▶'}
        </span>
      )}
      {renderValue()}
    </span>
  );
};

export default JSONViewer;
