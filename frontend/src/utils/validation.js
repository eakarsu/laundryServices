export const validateEmail = (email) => {
  if (!email) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email format';
  return '';
};

export const validatePhone = (phone) => {
  if (!phone) return '';
  if (!/^[\d\s\-+()]{7,15}$/.test(phone)) return 'Invalid phone number';
  return '';
};

export const validateRequired = (value, fieldName = 'This field') => {
  if (!value || (typeof value === 'string' && !value.trim())) return `${fieldName} is required`;
  return '';
};

export const validatePassword = (password) => {
  const errors = [];
  if (!password || password.length < 8) errors.push('At least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('Uppercase letter required');
  if (!/[a-z]/.test(password)) errors.push('Lowercase letter required');
  if (!/[0-9]/.test(password)) errors.push('Number required');
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('Special character required');
  return errors;
};

export const validateMinLength = (value, min, fieldName = 'This field') => {
  if (value && value.length < min) return `${fieldName} must be at least ${min} characters`;
  return '';
};

export const validateForm = (values, rules) => {
  const errors = {};
  Object.keys(rules).forEach(field => {
    const error = rules[field](values[field], values);
    if (error) errors[field] = error;
  });
  return errors;
};
