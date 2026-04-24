import { FiAlertTriangle, FiInfo, FiAlertCircle } from 'react-icons/fi';

const ConfirmDialog = ({ isOpen, title, message, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onCancel, variant = 'danger' }) => {
  if (!isOpen) return null;

  const variantStyles = {
    danger: { icon: <FiAlertTriangle size={24} />, color: '#ef4444', btnClass: 'btn-danger' },
    warning: { icon: <FiAlertCircle size={24} />, color: '#f59e0b', btnClass: 'btn-warning' },
    info: { icon: <FiInfo size={24} />, color: '#3b82f6', btnClass: 'btn-primary' }
  };

  const style = variantStyles[variant] || variantStyles.danger;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: style.color }}>
            {style.icon} {title}
          </h3>
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
        <div className="modal-footer" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onCancel}>{cancelText}</button>
          <button className={`btn ${style.btnClass}`} onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
