import { FiCheck, FiX } from 'react-icons/fi';

const checks = [
  { label: 'At least 8 characters', test: p => p.length >= 8 },
  { label: 'Uppercase letter', test: p => /[A-Z]/.test(p) },
  { label: 'Lowercase letter', test: p => /[a-z]/.test(p) },
  { label: 'Number', test: p => /[0-9]/.test(p) },
  { label: 'Special character', test: p => /[!@#$%^&*(),.?":{}|<>]/.test(p) }
];

const getStrength = (password) => {
  const passed = checks.filter(c => c.test(password)).length;
  if (passed <= 1) return { label: 'Weak', color: '#ef4444', width: '20%' };
  if (passed <= 2) return { label: 'Fair', color: '#f59e0b', width: '40%' };
  if (passed <= 3) return { label: 'Good', color: '#3b82f6', width: '70%' };
  return { label: 'Strong', color: '#22c55e', width: '100%' };
};

const PasswordStrengthMeter = ({ password = '' }) => {
  const strength = getStrength(password);

  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: strength.width, backgroundColor: strength.color, transition: 'all 0.3s', borderRadius: '2px' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
        <span style={{ fontSize: '12px', color: strength.color, fontWeight: 600 }}>{password ? strength.label : ''}</span>
      </div>
      <div style={{ marginTop: '8px' }}>
        {checks.map((check, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: check.test(password) ? '#22c55e' : '#94a3b8', marginBottom: '2px' }}>
            {check.test(password) ? <FiCheck size={12} /> : <FiX size={12} />}
            {check.label}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PasswordStrengthMeter;
