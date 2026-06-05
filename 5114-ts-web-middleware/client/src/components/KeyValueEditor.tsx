import React from 'react';
import { KeyValuePair } from '../types';
import { generateId } from '../utils/format';

interface KeyValueEditorProps {
  items: KeyValuePair[];
  onChange: (items: KeyValuePair[]) => void;
  placeholderKey?: string;
  placeholderValue?: string;
}

const KeyValueEditor: React.FC<KeyValueEditorProps> = ({
  items,
  onChange,
  placeholderKey = 'Key',
  placeholderValue = 'Value',
}) => {
  const addItem = () => {
    onChange([...items, { id: generateId(), key: '', value: '', enabled: true }]);
  };

  const updateItem = (id: string, field: 'key' | 'value', value: string) => {
    onChange(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const toggleEnabled = (id: string) => {
    onChange(items.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item)));
  };

  const removeItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={item.id} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={item.enabled}
            onChange={() => toggleEnabled(item.id)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <input
            type="text"
            value={item.key}
            onChange={(e) => updateItem(item.id, 'key', e.target.value)}
            placeholder={`${placeholderKey} ${index + 1}`}
            className={`flex-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              !item.enabled ? 'bg-gray-100 text-gray-400' : ''
            }`}
          />
          <input
            type="text"
            value={item.value}
            onChange={(e) => updateItem(item.id, 'value', e.target.value)}
            placeholder={placeholderValue}
            className={`flex-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              !item.enabled ? 'bg-gray-100 text-gray-400' : ''
            }`}
          />
          <button
            onClick={() => removeItem(item.id)}
            className="px-2 py-2 text-red-600 hover:bg-red-50 rounded-md text-sm"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        onClick={addItem}
        className="flex items-center gap-1 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-md text-sm"
      >
        <span>+</span> 添加参数
      </button>
    </div>
  );
};

export default KeyValueEditor;
