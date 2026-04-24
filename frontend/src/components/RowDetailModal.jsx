import { FiX, FiEdit, FiTrash2 } from 'react-icons/fi';
import { useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

const RowDetailModal = ({ isOpen, onClose, data, title, fields, onEdit, onDelete }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (isOpen !== undefined && !isOpen) return null;
  if (!data) return null;

  const formatValue = (value) => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (value instanceof Date || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value))) {
      return new Date(value).toLocaleString();
    }
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
          <div className="modal-header">
            <h3>{title}</h3>
            <button className="btn btn-sm btn-outline" onClick={onClose}><FiX /></button>
          </div>
          <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <table className="table">
              <tbody>
                {(fields || Object.keys(data)).map(field => {
                  const label = typeof field === 'object' ? field.label : field;
                  const key = typeof field === 'object' ? field.key : field;
                  const value = key.includes('.') ? key.split('.').reduce((o, k) => o?.[k], data) : data[key];
                  return (
                    <tr key={key}>
                      <td style={{ fontWeight: 600, width: '40%', textTransform: 'capitalize' }}>{label.replace(/([A-Z])/g, ' $1').trim()}</td>
                      <td>{formatValue(value)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="modal-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            {onEdit && <button className="btn btn-primary" onClick={() => onEdit(data)}><FiEdit size={14} /> Edit</button>}
            {onDelete && <button className="btn btn-danger" onClick={() => setShowDeleteConfirm(true)}><FiTrash2 size={14} /> Delete</button>}
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Record"
        message="Are you sure you want to delete this record? This action cannot be undone."
        confirmText="Delete"
        onConfirm={() => { setShowDeleteConfirm(false); onDelete(data); }}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />
    </>
  );
};

export default RowDetailModal;
