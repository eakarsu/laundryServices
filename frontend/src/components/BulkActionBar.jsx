import { FiTrash2, FiEdit, FiX } from 'react-icons/fi';
import { useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

const BulkActionBar = ({ selectedCount, onBulkDelete, onBulkUpdate, onClearSelection, updateOptions = [] }) => {
  const [showConfirm, setShowConfirm] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <>
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        backgroundColor: '#1e293b', color: 'white',
        padding: '12px 20px', borderRadius: '8px', marginBottom: '16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <span style={{ fontWeight: 600 }}>{selectedCount} item{selectedCount !== 1 ? 's' : ''} selected</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          {updateOptions.map((opt, i) => (
            <button key={i} className="btn btn-sm btn-outline" style={{ color: 'white', borderColor: 'white' }} onClick={() => onBulkUpdate(opt.data)}>
              <FiEdit size={14} /> {opt.label}
            </button>
          ))}
          <button className="btn btn-sm btn-danger" onClick={() => setShowConfirm(true)}>
            <FiTrash2 size={14} /> Delete Selected
          </button>
          <button className="btn btn-sm btn-outline" style={{ color: 'white', borderColor: 'white' }} onClick={onClearSelection}>
            <FiX size={14} />
          </button>
        </div>
      </div>
      <ConfirmDialog
        isOpen={showConfirm}
        title="Delete Selected Items"
        message={`Are you sure you want to delete ${selectedCount} selected item${selectedCount !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmText="Delete All"
        onConfirm={() => { setShowConfirm(false); onBulkDelete(); }}
        onCancel={() => setShowConfirm(false)}
        variant="danger"
      />
    </>
  );
};

export default BulkActionBar;
