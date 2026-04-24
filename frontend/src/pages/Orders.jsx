import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiSearch, FiPlus, FiEye, FiDownload, FiFileText } from 'react-icons/fi';
import { toast } from 'react-toastify';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../services/api';
import SortableHeader from '../components/SortableHeader';
import BulkActionBar from '../components/BulkActionBar';
import RowDetailModal from '../components/RowDetailModal';
import { TableSkeleton } from '../components/LoadingSkeleton';

function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedIds, setSelectedIds] = useState([]);
  const [detailData, setDetailData] = useState(null);

  const statuses = ['PENDING', 'PICKED_UP', 'PROCESSING', 'CLEANING', 'PRESSING', 'QUALITY_CHECK', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED'];

  useEffect(() => { fetchOrders(); }, [page, status, sortBy, sortOrder]);

  const fetchOrders = async () => {
    try {
      let url = `/orders?page=${page}&limit=20&sortBy=${sortBy}&sortOrder=${sortOrder}`;
      if (status) url += `&status=${status}`;
      const res = await api.get(url);
      setOrders(res.data.orders);
      setTotalPages(res.data.totalPages);
    } catch (error) {
      toast.error('Error fetching orders');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field, order) => { setSortBy(field); setSortOrder(order); };

  const getStatusBadge = (s) => {
    const colors = { PENDING: 'badge-warning', PICKED_UP: 'badge-info', PROCESSING: 'badge-primary', CLEANING: 'badge-primary', PRESSING: 'badge-primary', QUALITY_CHECK: 'badge-info', READY: 'badge-success', OUT_FOR_DELIVERY: 'badge-info', DELIVERED: 'badge-success', COMPLETED: 'badge-success', CANCELLED: 'badge-danger' };
    return colors[s] || 'badge-secondary';
  };

  const handleSelectAll = (e) => setSelectedIds(e.target.checked ? orders.map(o => o.id) : []);
  const handleSelectRow = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const handleBulkDelete = async () => {
    try {
      await api.delete('/orders/bulk', { data: { ids: selectedIds } });
      toast.success(`${selectedIds.length} orders deleted`);
      setSelectedIds([]);
      fetchOrders();
    } catch (error) { toast.error('Error deleting orders'); }
  };

  const handleBulkUpdate = async (data) => {
    try {
      await api.patch('/orders/bulk', { ids: selectedIds, data });
      toast.success(`${selectedIds.length} orders updated`);
      setSelectedIds([]);
      fetchOrders();
    } catch (error) { toast.error('Error updating orders'); }
  };

  const handleExportCSV = async () => {
    try {
      const res = await api.get(`/orders?format=csv&sortBy=${sortBy}&sortOrder=${sortOrder}${status ? `&status=${status}` : ''}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.setAttribute('download', 'orders.csv');
      document.body.appendChild(a); a.click(); a.remove();
      toast.success('CSV exported');
    } catch (error) { toast.error('Error exporting CSV'); }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text('Orders Report', 14, 16);
    autoTable(doc, {
      startY: 22,
      head: [['Order #', 'Customer', 'Items', 'Total', 'Status', 'Date']],
      body: orders.map(o => [o.orderNumber, `${o.customer?.firstName} ${o.customer?.lastName}`, o.items?.length || 0, `$${parseFloat(o.total).toFixed(2)}`, o.status, new Date(o.createdAt).toLocaleDateString()])
    });
    doc.save('orders.pdf');
    toast.success('PDF exported');
  };

  const detailFields = [
    { label: 'Order Number', key: 'orderNumber' }, { label: 'Status', key: 'status' },
    { label: 'Customer', key: 'customer.firstName' }, { label: 'Total', key: 'total' },
    { label: 'Subtotal', key: 'subtotal' }, { label: 'Tax', key: 'tax' },
    { label: 'Discount', key: 'discount' }, { label: 'Rush', key: 'isRush' },
    { label: 'Created', key: 'createdAt' }
  ];

  if (loading) return <div style={{ padding: 24 }}><TableSkeleton rows={8} cols={8} /></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="page-subtitle">Manage and track all orders</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline" onClick={handleExportCSV}><FiDownload /> CSV</button>
          <button className="btn btn-outline" onClick={handleExportPDF}><FiFileText /> PDF</button>
          <Link to="/orders/new" className="btn btn-primary"><FiPlus /> New Order</Link>
        </div>
      </div>

      <BulkActionBar selectedCount={selectedIds.length} onBulkDelete={handleBulkDelete} onBulkUpdate={handleBulkUpdate} onClearSelection={() => setSelectedIds([])}
        updateOptions={[{ label: 'Mark Completed', data: { status: 'COMPLETED' } }, { label: 'Cancel', data: { status: 'CANCELLED' } }]} />

      <div className="card">
        <div className="card-header">
          <div className="flex gap-2">
            <div className="search-box">
              <FiSearch className="search-icon" />
              <input type="text" className="search-input" placeholder="Search orders..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="form-select" style={{ width: 200 }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All Statuses</option>
              {statuses.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th><input type="checkbox" onChange={handleSelectAll} checked={selectedIds.length === orders.length && orders.length > 0} /></th>
                <SortableHeader label="Order #" field="orderNumber" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <th>Customer</th>
                <th>Items</th>
                <SortableHeader label="Total" field="total" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <SortableHeader label="Status" field="status" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <th>Rush</th>
                <SortableHeader label="Created" field="createdAt" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id} onClick={() => setDetailData(order)} style={{ cursor: 'pointer' }}>
                  <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(order.id)} onChange={() => handleSelectRow(order.id)} /></td>
                  <td><Link to={`/orders/${order.id}`} style={{ fontWeight: 500 }} onClick={e => e.stopPropagation()}>{order.orderNumber}</Link></td>
                  <td>{order.customer?.firstName} {order.customer?.lastName}</td>
                  <td>{order.items?.length || 0} items</td>
                  <td>${parseFloat(order.total).toFixed(2)}</td>
                  <td><span className={`badge ${getStatusBadge(order.status)}`}>{order.status.replace('_', ' ')}</span></td>
                  <td>{order.isRush && <span className="badge badge-danger">RUSH</span>}</td>
                  <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td onClick={e => e.stopPropagation()}><Link to={`/orders/${order.id}`} className="btn btn-outline btn-sm"><FiEye /> View</Link></td>
                </tr>
              ))}
              {orders.length === 0 && <tr><td colSpan="9" className="text-center" style={{ padding: 40, color: '#64748b' }}>No orders found</td></tr>}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="pagination">
            <button className="pagination-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}>Previous</button>
            <span style={{ padding: '0 16px' }}>Page {page} of {totalPages}</span>
            <button className="pagination-btn" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>Next</button>
          </div>
        )}
      </div>

      <RowDetailModal isOpen={!!detailData} onClose={() => setDetailData(null)} data={detailData} title="Order Details" fields={detailFields}
        onEdit={(o) => { setDetailData(null); window.location.href = `/orders/${o.id}`; }} onDelete={async (o) => { try { await api.delete('/orders/bulk', { data: { ids: [o.id] } }); toast.success('Order deleted'); setDetailData(null); fetchOrders(); } catch { toast.error('Error'); } }} />
    </div>
  );
}

export default Orders;
