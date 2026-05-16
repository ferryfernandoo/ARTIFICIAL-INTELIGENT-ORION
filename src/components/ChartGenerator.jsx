import React, { useState } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import './ChartGenerator.css';

const ChartGenerator = ({ data, type = 'pie', title = '', explanation = null }) => {
  const [showModal, setShowModal] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  // Default colors for charts
  const COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#52B788',
    '#D62828', '#F77F00', '#FCBF49', '#06A77D', '#003f5c',
    '#bc5090', '#ffa600', '#58508d', '#ff6e40', '#00b4d8'
  ];

  // Calculate statistics
  const calculateStats = () => {
    const sorted = [...data].sort((a, b) => b.value - a.value);
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const highest = sorted[0];
    const lowest = sorted[sorted.length - 1];
    const average = (total / data.length).toFixed(2);
    
    return {
      highest,
      lowest,
      total,
      average,
      count: data.length
    };
  };

  const stats = calculateStats();

  if (!data || data.length === 0) {
    return (
      <div className="chart-container">
        <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>
          Tidak ada data untuk ditampilkan
        </p>
      </div>
    );
  }

  // Pie Chart
  if (type === 'pie') {
    return (
      <>
        <div className="chart-container">
          <div className="chart-header">
            {title && <h3 className="chart-title">{title}</h3>}
            <div className="chart-buttons">
              <button 
                className="btn-explanation"
                onClick={() => setShowLegend(true)}
                title="Lihat keterangan warna"
              >
                🎨 Keterangan
              </button>
              <button 
                className="btn-explanation"
                onClick={() => setShowModal(true)}
                title="Lihat penjelasan statistik"
              >
                📊 Penjelasan
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="45%"
                labelLine={false}
                label={false}
                outerRadius={90}
                fill="#8884d8"
                dataKey="value"
                animationBegin={0}
                animationDuration={800}
                animationEasing="ease-out"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name, props) => {
                  const percent = ((props.payload.value / data.reduce((sum, item) => sum + item.value, 0)) * 100).toFixed(1);
                  return `${value} (${percent}%)`;
                }}
                labelFormatter={(label) => `${data.find(d => d.name === label)?.name || label}`}
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '2px solid #000',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '12px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Modal Penjelasan */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>📊 Penjelasan Statistik</h2>
                <button 
                  className="modal-close"
                  onClick={() => setShowModal(false)}
                >
                  ✕
                </button>
              </div>
              
              <div className="modal-body">
                {explanation ? (
                  <div className="explanation-content">
                    {typeof explanation === 'string' ? (
                      <p>{explanation}</p>
                    ) : (
                      <div>{explanation}</div>
                    )}
                  </div>
                ) : (
                  <div className="explanation-content">
                    <p><strong>Analisis Data Penjualan</strong></p>
                    <p style={{ marginBottom: '16px' }}>
                      Berdasarkan data penjualan yang ditampilkan dalam pie chart, berikut adalah informasi statistik utama:
                    </p>
                    
                    <p style={{ marginBottom: '12px' }}>
                      <strong>🏆 Buah Terlaris:</strong><br/>
                      <span style={{ color: '#FF6B6B' }}>{stats.highest?.name}</span> dengan penjualan <strong>{stats.highest?.value} kg</strong> yang merupakan produk dengan performa terbaik.
                    </p>
                    
                    <p style={{ marginBottom: '12px' }}>
                      <strong>📉 Buah Paling Sedikit:</strong><br/>
                      <span style={{ color: '#4ECDC4' }}>{stats.lowest?.name}</span> dengan penjualan <strong>{stats.lowest?.value} kg</strong>, memerlukan perhatian khusus untuk meningkatkan penjualannya.
                    </p>
                    
                    <p style={{ marginBottom: '12px' }}>
                      <strong>📦 Total Penjualan:</strong><br/>
                      Jumlah keseluruhan adalah <strong>{stats.total} kg</strong> dari <strong>{stats.count} jenis buah</strong> yang dijual.
                    </p>
                    
                    <p>
                      <strong>📈 Rata-rata Penjualan:</strong><br/>
                      Rata-rata penjualan per jenis adalah <strong>{stats.average} kg</strong>, yang dapat digunakan sebagai benchmark performa.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Keterangan Warna */}
        {showLegend && (
          <div className="modal-overlay" onClick={() => setShowLegend(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>🎨 Keterangan Warna</h2>
                <button 
                  className="modal-close"
                  onClick={() => setShowLegend(false)}
                >
                  ✕
                </button>
              </div>
              
              <div className="modal-body">
                <div className="legend-list">
                  {data.map((item, index) => (
                    <div key={index} className="legend-item">
                      <div 
                        className="legend-color"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="legend-name">{item.name}</span>
                      <span className="legend-value">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Bar Chart
  if (type === 'bar') {
    return (
      <div className="chart-container">
        {title && <h3 className="chart-title">{title}</h3>}
        <ResponsiveContainer width="100%" height={350}>
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#ddd" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '2px solid #000',
                borderRadius: '8px',
                padding: '12px'
              }}
            />
            <Legend />
            <Bar dataKey="value" fill="#FF6B6B" radius={[8, 8, 0, 0]} animationDuration={800} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Line Chart
  if (type === 'line') {
    return (
      <div className="chart-container">
        {title && <h3 className="chart-title">{title}</h3>}
        <ResponsiveContainer width="100%" height={350}>
          <LineChart
            data={data}
            margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#ddd" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '2px solid #000',
                borderRadius: '8px',
                padding: '12px'
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#4ECDC4"
              strokeWidth={3}
              dot={{ fill: '#4ECDC4', r: 6 }}
              animationDuration={800}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Radar Chart
  if (type === 'radar') {
    return (
      <div className="chart-container">
        {title && <h3 className="chart-title">{title}</h3>}
        <ResponsiveContainer width="100%" height={350}>
          <RadarChart data={data}>
            <PolarGrid stroke="#ddd" />
            <PolarAngleAxis dataKey="name" />
            <PolarRadiusAxis angle={90} domain={[0, 'auto']} />
            <Radar name="Nilai" dataKey="value" stroke="#45B7D1" fill="#45B7D1" fillOpacity={0.6} animationDuration={800} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '2px solid #000',
                borderRadius: '8px',
                padding: '12px'
              }}
            />
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Infografis - Grid layout
  if (type === 'infographic') {
    return (
      <div className="infographic-container">
        {title && <h2 className="infographic-title">{title}</h2>}
        <div className="infographic-grid">
          {data.map((item, index) => (
            <div
              key={index}
              className="infographic-card"
              style={{
                borderLeftColor: COLORS[index % COLORS.length],
                backgroundColor: COLORS[index % COLORS.length] + '15'
              }}
            >
              <div className="infographic-icon" style={{ color: COLORS[index % COLORS.length] }}>
                {item.icon || '📊'}
              </div>
              <div className="infographic-label">{item.name}</div>
              <div className="infographic-value" style={{ color: COLORS[index % COLORS.length] }}>
                {item.value}
              </div>
              {item.description && (
                <div className="infographic-description">{item.description}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
};

export default ChartGenerator;
