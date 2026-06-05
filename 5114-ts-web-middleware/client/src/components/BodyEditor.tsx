import React from 'react';
import { BodyType, KeyValuePair } from '../types';
import KeyValueEditor from './KeyValueEditor';
import { formatJSON, isValidJSON } from '../utils/format';

interface BodyEditorProps {
  bodyType: BodyType;
  onTypeChange: (type: BodyType) => void;
  json: string;
  onJsonChange: (value: string) => void;
  formdata: KeyValuePair[];
  onFormdataChange: (items: KeyValuePair[]) => void;
  raw: string;
  onRawChange: (value: string) => void;
}

const bodyTypes: { value: BodyType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'json', label: 'JSON' },
  { value: 'formdata', label: 'Form Data' },
  { value: 'raw', label: 'Raw' },
];

const BodyEditor: React.FC<BodyEditorProps> = ({
  bodyType,
  onTypeChange,
  json,
  onJsonChange,
  formdata,
  onFormdataChange,
  raw,
  onRawChange,
}) => {
  const formatJsonHandler = () => {
    onJsonChange(formatJSON(json));
  };

  const jsonValid = isValidJSON(json);

  return (
    <div className="space-y-4">
      <div className="flex border-b border-gray-200">
        {bodyTypes.map((type) => (
          <button
            key={type.value}
            onClick={() => onTypeChange(type.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              bodyType === type.value
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      {bodyType === 'json' && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">
              {jsonValid ? '✓ Valid JSON' : '✗ Invalid JSON'}
            </span>
            <button
              onClick={formatJsonHandler}
              className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
            >
              格式化
            </button>
          </div>
          <textarea
            value={json}
            onChange={(e) => onJsonChange(e.target.value)}
            placeholder='{"key": "value"}'
            className={`w-full h-64 px-3 py-2 border rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              !jsonValid ? 'border-red-300' : ''
            }`}
            spellCheck={false}
          />
        </div>
      )}

      {bodyType === 'formdata' && (
        <KeyValueEditor
          items={formdata}
          onChange={onFormdataChange}
          placeholderKey="字段名"
          placeholderValue="值"
        />
      )}

      {bodyType === 'raw' && (
        <textarea
          value={raw}
          onChange={(e) => onRawChange(e.target.value)}
          placeholder="输入原始内容..."
          className="w-full h-64 px-3 py-2 border rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          spellCheck={false}
        />
      )}

      {bodyType === 'none' && (
        <div className="text-sm text-gray-500 py-4 text-center">
          请求不包含 Body
        </div>
      )}
    </div>
  );
};

export default BodyEditor;
