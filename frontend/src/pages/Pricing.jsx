import React, { useState, useEffect } from 'react';
import { FiSave, FiDollarSign } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../services/api';

function Pricing() {
  const [matrix, setMatrix] = useState(null);
  const [loading, setLoading] = useState(true);
  const [prices, setPrices] = useState({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchPriceMatrix();
  }, []);

  const fetchPriceMatrix = async () => {
    try {
      const res = await api.get('/pricing/matrix');
      setMatrix(res.data);

      // Initialize prices
      const priceMap = {};
      res.data.matrix.forEach(row => {
        row.prices.forEach(p => {
          priceMap[`${row.service.id}-${p.garmentType.id}`] = p.price;
        });
      });
      setPrices(priceMap);
    } catch (error) {
      toast.error('Error loading pricing');
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (serviceId, garmentId, value) => {
    setPrices({
      ...prices,
      [`${serviceId}-${garmentId}`]: parseFloat(value) || 0
    });
    setHasChanges(true);
  };

  const saveAllPrices = async () => {
    try {
      const priceUpdates = Object.entries(prices).map(([key, price]) => {
        const [serviceId, garmentTypeId] = key.split('-');
        return { serviceId, garmentTypeId, price };
      });

      await api.post('/pricing/service-prices/bulk', { prices: priceUpdates });
      toast.success('Prices updated successfully');
      setHasChanges(false);
    } catch (error) {
      toast.error('Error saving prices');
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pricing Matrix</h1>
          <p className="page-subtitle">Set prices for each service and garment combination</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={saveAllPrices}
          disabled={!hasChanges}
        >
          <FiSave /> Save All Changes
        </button>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="table" style={{ minWidth: 800 }}>
          <thead>
            <tr>
              <th style={{ position: 'sticky', left: 0, background: 'white', zIndex: 1 }}>
                <FiDollarSign /> Service / Garment
              </th>
              {matrix?.garmentTypes.map(garment => (
                <th key={garment.id} style={{ textAlign: 'center', fontSize: 12 }}>
                  {garment.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix?.matrix.map(row => (
              <tr key={row.service.id}>
                <td style={{ position: 'sticky', left: 0, background: 'white', fontWeight: 500, zIndex: 1 }}>
                  {row.service.name}
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    Base: ${parseFloat(row.service.basePrice).toFixed(2)}
                  </div>
                </td>
                {row.prices.map(p => (
                  <td key={p.garmentType.id} style={{ padding: 4 }}>
                    <input
                      type="number"
                      step="0.01"
                      style={{
                        width: 70,
                        padding: '6px 8px',
                        border: '1px solid #e2e8f0',
                        borderRadius: 4,
                        textAlign: 'center',
                        fontSize: 13
                      }}
                      value={prices[`${row.service.id}-${p.garmentType.id}`] || ''}
                      onChange={(e) => handlePriceChange(row.service.id, p.garmentType.id, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h4 style={{ marginBottom: 16 }}>Pricing Tips</h4>
        <ul style={{ color: '#64748b', fontSize: 14, paddingLeft: 20 }}>
          <li>Set specific prices for each service and garment combination</li>
          <li>If no price is set, the garment's base price will be used</li>
          <li>Consider offering volume discounts through subscription plans</li>
          <li>Rush orders automatically add a 50% surcharge</li>
        </ul>
      </div>
    </div>
  );
}

export default Pricing;
