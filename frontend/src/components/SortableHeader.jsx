import { FiChevronUp, FiChevronDown, FiChevronsUp } from 'react-icons/fi';

const SortableHeader = ({ label, field, sortBy, sortOrder, currentSort, direction, onSort }) => {
  const activeSortField = sortBy || currentSort;
  const activeSortOrder = sortOrder || direction;
  const isActive = activeSortField === field;

  const handleClick = () => {
    if (isActive) {
      onSort(field, activeSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      onSort(field, 'asc');
    }
  };

  return (
    <th onClick={handleClick} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {label}
        <span style={{ display: 'flex', flexDirection: 'column', opacity: isActive ? 1 : 0.3 }}>
          {isActive && activeSortOrder === 'asc' ? <FiChevronUp size={14} /> : isActive && activeSortOrder === 'desc' ? <FiChevronDown size={14} /> : <FiChevronsUp size={14} />}
        </span>
      </div>
    </th>
  );
};

export default SortableHeader;
