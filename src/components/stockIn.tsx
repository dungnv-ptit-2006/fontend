// StockInManagement.tsx
import React, { useState, useEffect } from 'react';
import './stockin.css';
import axios from 'axios';
import { v4 as uuidv4 } from "uuid";
import {

  FaCheck,
  FaExclamationTriangle,
  FaTimes,
  FaSpinner,
  FaTrash,
  FaEye,
  FaChevronLeft,
  FaChevronRight,
  FaPlus,
} from 'react-icons/fa';

// Types
interface Supplier {
  supplier_id: number;
  name: string;
}


interface StockInOrder {
  stock_in_order_id: number;
  supplier_name: string;
  total_amount: number;
  status: 'draft' | 'confirmed' | 'cancelled';
  created_by: number;
  created_by_name: string;
  created_at: string;
  note?: string;
}

interface StockInItem {
  product_id: number;
  product_name?: string;
  product_sku: string;
  quantity: number;
  unit_cost: number;
  total_price: number;
}

interface StockInOrderDetail extends StockInOrder {
  items: StockInItem[];
}

interface Product {
  product_id: number;
  name: string;
  sku?: string;
  current_cost_price: number;
  stock_quantity: number;
}

interface StockInFormData {
  supplier_name: string;
  items: StockInItem[];
  note?: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// StockIn Service
class StockInService {
  private baseURL = 'http://localhost:5000/api';

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Network error';
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || `HTTP error! status: ${response.status}`;
      } catch {
        errorMessage = errorText || `HTTP error! status: ${response.status}`;
      }
      
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'API request failed');
    }
    
    return data;
  }

  async getAllStockInOrders(page: number = 1, limit: number = 10, search: string = ''): Promise<{ stockInOrders: StockInOrder[], pagination: PaginationInfo }> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(search && { search })
    });

    const response = await fetch(`${this.baseURL}/stock-in?${params}`, {
      headers: this.getAuthHeaders(),
    });

    const result = await this.handleResponse<{ data: StockInOrder[], pagination: PaginationInfo }>(response);
    
    return {
      stockInOrders: result.data || [],
      pagination: result.pagination || {
        page,
        limit,
        total: 0,
        totalPages: 0
      }
    };
  }
async getAllProducts(): Promise<Product[]> {
  const token = localStorage.getItem('auth_token');
  if (!token) throw new Error('Chưa đăng nhập');

  const response = await fetch('http://localhost:5000/api/products', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  
  // result.data.products phải là mảng
  if (!result.data || !Array.isArray(result.data.products)) {
    throw new Error('API trả về không phải mảng sản phẩm');
  }

  return result.data.products;
}


  async getStockInOrderById(id: number): Promise<StockInOrderDetail> {
    const response = await fetch(`${this.baseURL}/stock-in/${id}`, {
      headers: this.getAuthHeaders(),
    });

    const result = await this.handleResponse<{ data: { stockInOrder: StockInOrderDetail } }>(response);
    return result.data.stockInOrder;
  }

  async createStockInOrder(stockInData: StockInFormData): Promise<number> {
    const response = await fetch(`${this.baseURL}/stock-in`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(stockInData),
    });

    const result = await this.handleResponse<{ data: { stock_in_order_id: number, total_amount: number } }>(response);
    return result.data.stock_in_order_id;
  }

  async updateStockInOrderStatus(id: number, status: string): Promise<void> {
    const response = await fetch(`${this.baseURL}/stock-in/${id}/status`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ status }),
    });

    await this.handleResponse(response);
  }

  async searchProducts(query: string): Promise<Product[]> {
    const response = await fetch(`${this.baseURL}/products/search?q=${encodeURIComponent(query)}&limit=10`, {
      headers: this.getAuthHeaders(),
    });

    const result = await this.handleResponse<{ data: { products: Product[] } }>(response);
    return result.data.products || [];
  }
}

const stockInService = new StockInService();

// StockIn List Component
const StockInList: React.FC<{
  orders: StockInOrder[];
  pagination: PaginationInfo;
  onViewDetails: (order: StockInOrder) => void;
  onConfirm: (order: StockInOrder) => void;
  onCancel: (order: StockInOrder) => void;
  onPageChange: (page: number) => void;
  loading: boolean;
}> = ({
  orders,
  pagination,
  onViewDetails,
  onConfirm,
  onCancel,
  onPageChange,
  loading,
}) => {
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('vi-VN');
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { class: 'status-draft', text: 'Nháp', action: true },
      confirmed: { class: 'status-confirmed', text: 'Đã xác nhận', action: false },
      cancelled: { class: 'status-cancelled', text: 'Đã hủy', action: false }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return <span className={`status-badge ${config.class}`}>{config.text}</span>;
  };

  const canPerformAction = (status: string) => {
    return status === 'draft';
  };

  const renderPagination = () => {
    if (!pagination || pagination.totalPages <= 1) return null;

    const pages = [];
    const { page, totalPages } = pagination;
    const maxVisiblePages = 5;
    let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <li key={i} className={`page-item ${i === page ? 'active' : ''}`}>
          <button 
            className="page-link" 
            onClick={() => onPageChange(i)}
            disabled={loading}
          >
            {i}
          </button>
        </li>
      );
    }

    return (
      <nav>
        <ul className="pagination justify-content-center">
          <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
            <button 
              className="page-link" 
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1 || loading}
            >
              <FaChevronLeft />
            </button>
          </li>
          {pages}
          <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}>
            <button 
              className="page-link" 
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages || loading}
            >
              <FaChevronRight />
            </button>
          </li>
        </ul>
      </nav>
    );
  };

  if (loading && orders.length === 0) {
    return (
      <div className="stockin-card">
        <div className="loading">
          <div className="spinner"></div>
          <p>Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="stockin-card">
      <div className="stockin-card-header">
        <h5 className="stockin-card-title">Danh sách phiếu nhập kho</h5>
        <div className="stockin-count">
          Tổng: {pagination?.total || 0} phiếu nhập
        </div>
      </div>
      <div className="stockin-card-body">
        <div className="table-responsive">
          <table className="stockin-table">
            <thead>
              <tr>
                <th>Mã phiếu</th>
                <th>Nhà cung cấp</th>
                <th>Tổng tiền</th>
                <th>Trạng thái</th>
                <th>Người tạo</th>
                <th>Ngày tạo</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.stock_in_order_id}>
                  <td>#{order.stock_in_order_id}</td>
                  <td>{order.supplier_name}</td>
                  <td>{formatCurrency(order.total_amount)}</td>
                  <td>{getStatusBadge(order.status)}</td>
                  <td>{order.created_by_name}</td>
                  <td>{formatDate(order.created_at)}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-info"
                        onClick={() => onViewDetails(order)}
                        title="Xem chi tiết"
                        disabled={loading}
                      >
                        <FaEye />
                      </button>
                      {canPerformAction(order.status) && (
                        <>
                          <button
                            className="btn-success"
                            onClick={() => onConfirm(order)}
                            title="Xác nhận phiếu"
                            disabled={loading}
                          >
                            <FaCheck />
                          </button>
                          <button
                            className="btn-danger"
                            onClick={() => onCancel(order)}
                            title="Hủy phiếu"
                            disabled={loading}
                          >
                            <FaTimes />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {orders.length === 0 && !loading && (
          <div className="empty-state">
            <p className="empty-text">Không có phiếu nhập kho nào</p>
          </div>
        )}

        {renderPagination()}
      </div>
    </div>
  );
};

// Product Select Component
const ProductSelect: React.FC<{
  onProductSelect: (product: Product) => void;
  disabled?: boolean;
}> = ({ onProductSelect, disabled }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
 
  const handleSearch = async (query: string) => {
    setSearchTerm(query);
    
    if (query.length < 2) {
      setProducts([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    try {
      const results = await stockInService.searchProducts(query);
      setProducts(results);
      setShowDropdown(true);
    } catch (error) {
      console.error('Error searching products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleProductSelect = (product: Product) => {
    onProductSelect(product);
    setSearchTerm('');
    setShowDropdown(false);
    setProducts([]);
  };

  return (
    <div className="product-search">
      <input
        type="text"
        className="form-input"
        placeholder="Tìm kiếm sản phẩm theo tên hoặc SKU..."
        value={searchTerm}
        onChange={(e) => handleSearch(e.target.value)}
        disabled={disabled}
      />
      
      {showDropdown && (
        <div className="search-dropdown">
          {loading ? (
            <div className="dropdown-item">Đang tải...</div>
          ) : products.length === 0 ? (
            <div className="dropdown-item">Không tìm thấy sản phẩm</div>
          ) : (
            products.map((product) => (
              <div
                key={product.product_id}
                className="dropdown-item"
                onClick={() => handleProductSelect(product)}
              >
                <div className="product-info">
                  <div className="product-name">{product.name}</div>
                  <div className="product-sku">SKU: {product.sku}</div>
                  <div className="product-price">
                    Giá vốn: {formatCurrency(product.current_cost_price)} | 
                    Tồn kho: {product.stock_quantity}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// StockIn Form Component
// StockInForm.tsx



// --- Types ---
interface ProductRaw {
  id?: number;
  product_id?: number;
  name?: string;
  sku?: string;
  price?: number;
  unit_price?: number;
  unitPrice?: number;
  stock_quantity?: number;
}

interface ProductNormalized {
  product_id: number;
  name: string;
  sku?: string;
  unit_price: number;
  stock_quantity: number;
}

interface StockItem {
  id: string;
  product_id: number;
  quantity: number;
  unit_price: number;
  total_price: number;
  product_name?: string;
  product_sku?: string;
}

interface StockFormData {
  items: StockInItem[];
  note?: string;
  supplier_name:string;
  supplier_id?: number | null;
}

interface StockInFormProps {
  onSubmit: (data: StockFormData) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

// --- Helpers ---
const toNumberSafe = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeProducts = (arr: ProductRaw[]): ProductNormalized[] =>
  (arr || []).map(p => {
    const id = p.product_id ?? p.id ?? 0;
    const unit_price = p.unit_price ?? p.price ?? p.unitPrice ?? 0;
    const stock_quantity = toNumberSafe(p.stock_quantity ?? 0, 0);
    return {
      product_id: toNumberSafe(id, 0),
      name: p.name ?? "Unknown",
      sku: p.sku,
      unit_price: toNumberSafe(unit_price, 0),
      stock_quantity,
    };
  });

// --- Component ---
// --- StockInForm.tsx (sửa lại) ---
const StockInForm: React.FC<StockInFormProps> = ({ onSubmit, onCancel, loading }) => {
  const [products, setProducts] = useState<ProductNormalized[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [supplierName, setSupplierName] = useState<string>("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isNewSupplier, setIsNewSupplier] = useState(false);

  // Load suppliers
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const token = localStorage.getItem("auth_token");
        const res = await fetch("http://localhost:5000/api/suppliers", {
          headers: { Authorization: token ? `Bearer ${token}` : "" }
        });
        if (!res.ok) return;
        const data = await res.json();
        setSuppliers(data.data?.suppliers || []);
      } catch (err) {
        console.error("Không thể tải nhà cung cấp:", err);
      }
    };
    fetchSuppliers();
  }, []);

  // Load products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const token = localStorage.getItem("auth_token");
        const res = await fetch("http://localhost:5000/api/products", {
          headers: { Authorization: token ? `Bearer ${token}` : "" }
        });
        if (!res.ok) return;
        const data = await res.json();
        const raw = Array.isArray(data) ? data : data.data ?? [];
        setProducts(normalizeProducts(raw));
      } catch (err) {
        console.error("Không thể tải sản phẩm:", err);
      }
    };
    fetchProducts();
  }, []);

  // Tính subtotal
  const subTotal = items.reduce((acc, it) => acc + (it.total_price || 0), 0);
  const createSupplier = async (name: string): Promise<number> => {
  const token = localStorage.getItem("auth_token");
  const res = await fetch("http://localhost:5000/api/suppliers", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "" 
    },
    body: JSON.stringify({ name }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message || "Tạo nhà cung cấp thất bại");
  return data.data.supplier_id;
};

  const handleAddItem = () => {
    if (!products.length) return alert("Chưa có sản phẩm trong hệ thống");
    const p = products[0];
    setItems(prev => [
      ...prev,
      {
        id: uuidv4(),
        product_id: p.product_id,
        quantity: 1,
        unit_price: p.unit_price,
        total_price: p.unit_price,
        product_name: p.name,
        product_sku: p.sku,
      },
    ]);
  };

  const handleRemoveItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  const handleItemChange = (id: string, field: "product_id" | "quantity", rawValue: any) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const copy = { ...item };
        if (field === "product_id") {
          const chosen = products.find(p => p.product_id === Number(rawValue));
          if (chosen) {
            copy.product_id = chosen.product_id;
            copy.product_name = chosen.name;
            copy.product_sku = chosen.sku;
            copy.unit_price = chosen.unit_price;
            copy.quantity = Math.min(copy.quantity || 1, chosen.stock_quantity);
            copy.total_price = copy.unit_price * copy.quantity;
          }
        } else if (field === "quantity") {
          const chosen = products.find(p => p.product_id === copy.product_id);
          const qty = Math.min(Math.max(1, Number(rawValue)), chosen?.stock_quantity ?? Infinity);
          copy.quantity = qty;
          copy.total_price = copy.unit_price * qty;
        }
        return copy;
      })
    );
  };

  // Submit
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!supplierName.trim()) {
    alert("Nhà cung cấp là bắt buộc");
    return;
  }
  if (!items.length) {
    alert("Vui lòng thêm ít nhất 1 sản phẩm");
    return;
  }

  setSubmitting(true);
  try {
    // Khai báo một lần
let supplier_id = selectedSupplierId;

// Nếu là nhà cung cấp mới, gọi API tạo mới
if (!supplier_id) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch("http://localhost:5000/api/suppliers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
    body: JSON.stringify({ name: supplierName.trim() }),
  });

  if (!res.ok) throw new Error("Tạo nhà cung cấp thất bại");

  const data = await res.json();
  supplier_id = data.data?.supplier_id ?? null; // Gán lại, không khai báo mới
}


    if (!supplier_id) {
      alert("Vui lòng chọn hoặc tạo nhà cung cấp trước khi tạo phiếu nhập");
      setSubmitting(false);
      return;
    }

  const payload: StockFormData = {
  supplier_name: supplierName.trim(),
  items: items.map(i => ({
    product_id: i.product_id,
    product_name: i.product_name || "Unknown",
    product_sku: i.product_sku || "N/A",
    quantity: i.quantity,
    unit_cost: i.unit_price,
    total_price: i.total_price,
  })),
};

// nếu cần, thêm supplier_id
(payload as any).supplier_id = supplier_id;



    await onSubmit(payload);

    // Reset form
    setItems([]);
    setNote("");
    setSupplierName("");
    setSelectedSupplierId(null);

  } catch (err: any) {
    console.error("Error creating order:", err);
    alert(err?.message ?? "Lỗi server khi tạo phiếu nhập");
  } finally {
    setSubmitting(false);
  }
};



  return (
    <div className="stockin-form-wrapper">
      <form onSubmit={handleSubmit} className="stockin-form">
        <div className="form-group">
          <label>Nhà cung cấp</label>
          <select
            value={selectedSupplierId ?? ""}
            onChange={e => {
              const val = e.target.value;
              if (val === "new") {
                setIsNewSupplier(true);
                setSelectedSupplierId(null);
                setSupplierName("");
              } else {
                setIsNewSupplier(false);
                setSelectedSupplierId(Number(val));
                const sup = suppliers.find(s => s.supplier_id === Number(val));
                setSupplierName(sup?.name || "");
              }
            }}
          >
            <option value="">-- Chọn nhà cung cấp --</option>
            {suppliers.map(s => (
              <option key={s.supplier_id} value={s.supplier_id}>{s.name}</option>
            ))}
            <option value="new">+ Thêm nhà cung cấp mới</option>
          </select>

          {isNewSupplier && (
            <input
              type="text"
              value={supplierName}
              onChange={e => setSupplierName(e.target.value)}
              placeholder="Nhập tên nhà cung cấp mới"
              required
            />
          )}
        </div>

        {/* Các phần thêm sản phẩm giống cũ */}
        <div className="order-items-header">
          <h4>Sản phẩm</h4>
          <button type="button" onClick={handleAddItem} disabled={loading || submitting || !products.length}>
            <FaPlus /> Thêm sản phẩm
          </button>
        </div>

        <div className="order-items-scroll">
          {items.map(item => (
            <div className="order-item-row" key={item.id}>
              <select
                value={item.product_id}
                onChange={e => handleItemChange(item.id, "product_id", Number(e.target.value))}
                disabled={loading || submitting}
              >
                {products.map(p => (
                  <option key={p.product_id} value={p.product_id}>
                    {p.name} ({p.sku ?? "N/A"}) - {formatCurrency(p.unit_price)} - Tồn kho: {p.stock_quantity}
                  </option>
                ))}
              </select>

              <input
                type="number"
                min={1}
                value={item.quantity}
                onChange={e => handleItemChange(item.id, "quantity", Number(e.target.value))}
                disabled={loading || submitting}
              />

              <div className="price">{formatCurrency(item.total_price)}</div>

              <button type="button" onClick={() => handleRemoveItem(item.id)} disabled={loading || submitting}>
                <FaTrash />
              </button>
            </div>
          ))}

          {items.length === 0 && <div className="empty-note">Chưa có sản phẩm. Bấm "Thêm sản phẩm" để bắt đầu.</div>}
        </div>

        <div className="order-summary">
          <div>Tổng cộng: <strong>{formatCurrency(subTotal)}</strong></div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={onCancel} disabled={loading || submitting}>
            Hủy
          </button>
          <button type="submit" disabled={loading || submitting}>
            {submitting ? <><FaSpinner className="spinner-small" /> Đang xử lý...</> : "Nhập kho"}
          </button>
        </div>
      </form>
    </div>
  );
};




// StockIn Details Component
const StockInDetails: React.FC<{
  order: StockInOrderDetail;
  onClose: () => void;
  onConfirm: (order: StockInOrderDetail) => void;
  onCancel: (order: StockInOrderDetail) => void;
  loading?: boolean;
}> = ({ 
  order, 
  onClose, 
  onConfirm,
  onCancel,
  loading = false 
}) => {
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { class: 'status-draft', text: 'Nháp' },
      confirmed: { class: 'status-confirmed', text: 'Đã xác nhận' },
      cancelled: { class: 'status-cancelled', text: 'Đã hủy' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return <span className={`status-badge large ${config.class}`}>{config.text}</span>;
  };

  const canPerformAction = (status: string) => {
    return status === 'draft';
  };

  return (
    <div className="stockin-card">
      <div className="stockin-card-header">
        <h5 className="stockin-card-title">Chi tiết phiếu nhập kho #{order.stock_in_order_id}</h5>
        <button 
          type="button" 
          className="close-btn" 
          onClick={onClose}
          disabled={loading}
        >
          <FaTimes />
        </button>
      </div>
      <div className="stockin-card-body">
        <div className="detail-section">
          <div className="detail-row">
            <div className="detail-label">Mã phiếu:</div>
            <div className="detail-value">#{order.stock_in_order_id}</div>
          </div>

          <div className="detail-row">
            <div className="detail-label">Nhà cung cấp:</div>
            <div className="detail-value">{order.supplier_name}</div>
          </div>

          <div className="detail-row">
            <div className="detail-label">Trạng thái:</div>
            <div className="detail-value">
              {getStatusBadge(order.status)}
            </div>
          </div>

          <div className="detail-row">
            <div className="detail-label">Người tạo:</div>
            <div className="detail-value">{order.created_by_name}</div>
          </div>

          <div className="detail-row">
            <div className="detail-label">Ngày tạo:</div>
            <div className="detail-value">{formatDate(order.created_at)}</div>
          </div>

          {order.note && (
            <div className="detail-row">
              <div className="detail-label">Ghi chú:</div>
              <div className="detail-value">{order.note}</div>
            </div>
          )}
        </div>

        <div className="items-section">
          <h6>Danh sách sản phẩm</h6>
          <div className="items-table">
            <table className="stockin-items-table">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>SKU</th>
                  <th>Số lượng</th>
                  <th>Đơn giá</th>
                  <th>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, index) => (
                  <tr key={index}>
                    <td>{item.product_name}</td>
                    <td>{item.product_sku}</td>
                    <td>{item.quantity}</td>
                    <td>{formatCurrency(item.unit_cost)}</td>
                    <td>{formatCurrency(item.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="total-section">
            <div className="total-label">Tổng cộng:</div>
            <div className="total-amount">{formatCurrency(order.total_amount)}</div>
          </div>
        </div>

        <div className="detail-actions">
          <button 
            className="btn-secondary" 
            onClick={onClose}
            disabled={loading}
          >
            Đóng
          </button>
          
          {canPerformAction(order.status) && (
            <>
              <button 
                className="btn-danger" 
                onClick={() => onCancel(order)}
                disabled={loading}
              >
                Hủy phiếu
              </button>
              <button 
                className="btn-success" 
                onClick={() => onConfirm(order)}
                disabled={loading}
              >
                Xác nhận phiếu
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper functions
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
};

// Main StockIn Management Component
const StockInManagement: React.FC = () => {
  const [orders, setOrders] = useState<StockInOrder[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<StockInOrderDetail | null>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  useEffect(() => {
    loadOrders();
  }, [pagination.page, pagination.limit]);

  const showMessage = (message: string, type: 'error' | 'success') => {
    if (type === 'error') {
      setError(message);
      setSuccess('');
    } else {
      setSuccess(message);
      setError('');
    }
    
    setTimeout(() => {
      if (type === 'error') {
        setError('');
      } else {
        setSuccess('');
      }
    }, 5000);
  };

  const loadOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await stockInService.getAllStockInOrders(
        pagination.page,
        pagination.limit,
        searchTerm
      );
      setOrders(response.stockInOrders);
      setPagination(response.pagination);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Không thể tải danh sách phiếu nhập';
      showMessage(errorMessage, 'error');
      console.error('Error loading orders:', err);
      
      setOrders([]);
      setPagination({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    loadOrders();
  };

  const handleCreateOrder = async (formData: StockInFormData) => {
    setFormLoading(true);
    try {
      await stockInService.createStockInOrder(formData);
      setShowForm(false);
      showMessage('Tạo phiếu nhập kho thành công!', 'success');
      loadOrders();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Lỗi khi tạo phiếu nhập';
      showMessage(errorMessage, 'error');
      console.error('Error creating order:', err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleConfirmOrder = async (order: StockInOrder) => {
    if (!window.confirm(`Bạn có chắc muốn xác nhận phiếu nhập #${order.stock_in_order_id}?`)) {
      return;
    }

    setLoading(true);
    try {
      await stockInService.updateStockInOrderStatus(order.stock_in_order_id, 'confirmed');
      showMessage('Xác nhận phiếu nhập thành công!', 'success');
      loadOrders();
      setSelectedOrder(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Không thể xác nhận phiếu nhập';
      showMessage(errorMessage, 'error');
      console.error('Error confirming order:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async (order: StockInOrder | StockInOrderDetail) => {
    if (!window.confirm(`Bạn có chắc muốn hủy phiếu nhập #${order.stock_in_order_id}?`)) {
      return;
    }

    setLoading(true);
    try {
      await stockInService.updateStockInOrderStatus(order.stock_in_order_id, 'cancelled');
      showMessage('Hủy phiếu nhập thành công!', 'success');
      loadOrders();
      setSelectedOrder(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Không thể hủy phiếu nhập';
      showMessage(errorMessage, 'error');
      console.error('Error cancelling order:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (order: StockInOrder) => {
    setLoading(true);
    try {
      const orderDetail = await stockInService.getStockInOrderById(order.stock_in_order_id);
      setSelectedOrder(orderDetail);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Không thể tải chi tiết phiếu nhập';
      showMessage(errorMessage, 'error');
      console.error('Error loading order details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
  };

  const resetView = () => {
    setShowForm(false);
    setSelectedOrder(null);
    setError('');
  };

  return (
    <div className="stockin-management">
      <div className="stockin-header">
        <h1>Quản Lý Nhập Kho</h1>
        <button
          className="btn-primary"
          onClick={() => {
            resetView();
            setShowForm(true);
          }}
          disabled={loading}
        >
          <FaPlus /> Tạo Phiếu Nhập
        </button>
      </div>

      {error && (
        <div className="error-alert">
          <div className="alert-content">
            <span className="alert-icon"><FaExclamationTriangle /></span>
            {error}
          </div>
          <button
            type="button"
            className="alert-close"
            onClick={() => setError('')}
          ><FaTimes/></button>
        </div>
      )}

      {success && (
        <div className="success-alert">
          <div className="alert-content">
            <span className="alert-icon"><FaCheck /></span>
            {success}
          </div>
          <button
            type="button"
            className="alert-close"
            onClick={() => setSuccess('')}
          ><FaTimes /></button>
        </div>
      )}

      <div className="search-section">
        <form onSubmit={handleSearch}>
          <div className="search-group">
            <input
              type="text"
              className="search-input"
              placeholder="Tìm kiếm theo mã phiếu, nhà cung cấp..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={loading}
            />
          </div>
        </form>
      </div>

      <div className="stockin-content">
        <div className={showForm || selectedOrder ? 'main-content' : 'full-content'}>
          <StockInList
            orders={orders}
            pagination={pagination}
            onViewDetails={handleViewDetails}
            onConfirm={handleConfirmOrder}
            onCancel={handleCancelOrder}
            onPageChange={handlePageChange}
            loading={loading}
          />
        </div>

        {(showForm || selectedOrder) && (
          <div className="sidebar-content">
            {showForm && (
              <StockInForm
                onSubmit={handleCreateOrder}
                onCancel={() => setShowForm(false)}
                loading={formLoading}
              />
            )}

            {selectedOrder && (
              <StockInDetails
                order={selectedOrder}
                onClose={() => setSelectedOrder(null)}
                onConfirm={handleConfirmOrder}
                onCancel={handleCancelOrder}
                loading={loading}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StockInManagement;