/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, FormEvent } from 'react';
import { 
  ShoppingBag, 
  Sparkles, 
  Plus, 
  Minus, 
  Trash2, 
  Edit2, 
  Search, 
  Filter, 
  Check, 
  Printer, 
  Lock, 
  LogOut, 
  Home, 
  Menu, 
  X, 
  DollarSign, 
  ClipboardList, 
  CheckCircle, 
  Clock, 
  Users, 
  ChevronRight,
  RefreshCw,
  Eye,
  AlertCircle,
  User,
  UserPlus
} from 'lucide-react';
import { 
  syncProductsFromServer, 
  syncTransactionsFromServer, 
  createProduct, 
  editProduct, 
  removeProduct, 
  checkoutTransaction, 
  confirmOnlinePayment,
  Product, 
  Transaction, 
  CartItem,
  initIndexedDB
} from './services/db';

type ViewState = 'Beranda' | 'Katalog' | 'KelolaProduk' | 'Kasir' | 'Riwayat';

interface LoggedInUser {
  email: string;
  nama: string;
  role: 'admin' | 'buyer';
}

export default function App() {
  // Page URL routing state
  const [notaIdFromUrl, setNotaIdFromUrl] = useState<string | null>(null);
  const [notaData, setNotaData] = useState<Transaction | null>(null);
  const [loadingNota, setLoadingNota] = useState<boolean>(false);
  const [notaError, setNotaError] = useState<string | null>(null);

  // Authentication states
  const [user, setUser] = useState<LoggedInUser | null>(() => {
    const saved = localStorage.getItem('boutique_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loginEmail, setLoginEmail] = useState('');
  const [loginNama, setLoginNama] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Enhanced Login States
  const [loginRole, setLoginRole] = useState<'buyer' | 'admin'>('buyer');
  const [buyerAction, setBuyerAction] = useState<'login' | 'register'>('login');
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleCustomEmail, setGoogleCustomEmail] = useState('');
  const [googleCustomName, setGoogleCustomName] = useState('');
  const [showGoogleCustomInput, setShowGoogleCustomInput] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // App core states
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Layout states
  const [currentView, setCurrentView] = useState<ViewState>('Beranda');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Cart state (for Buyer checkout)
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('boutique_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Selected size or variant state when viewing product quick addition
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({});

  // Search & Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'Semua' | 'Pakaian' | 'Kecantikan'>('Semua');

  // Admin Manage Product Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    nama: '',
    harga: 0,
    stok: 0,
    kategori: 'Pakaian' as 'Pakaian' | 'Kecantikan',
    urlGambar: '',
    keterangan: '',
    ukuranText: '' // Comma separated sizes
  });
  const [formError, setFormError] = useState('');

  // Admin POS states
  const [posCart, setPosCart] = useState<CartItem[]>([]);
  const [posSearchQuery, setPosSearchQuery] = useState('');
  const [posCategoryFilter, setPosCategoryFilter] = useState<'Semua' | 'Pakaian' | 'Kecantikan'>('Semua');

  // Selected transaction detail in modal
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // Synchronize cart with LocalStorage
  useEffect(() => {
    localStorage.setItem('boutique_cart', JSON.stringify(cart));
  }, [cart]);

  // 1. Check URL path on load to see if this is an online Nota Invoice view
  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/nota/')) {
      const match = path.match(/\/nota\/([^\/]+)/);
      if (match && match[1]) {
        setNotaIdFromUrl(match[1]);
      }
    }
  }, []);

  // 2. Fetch specific transaction if notaIdFromUrl is active (bypasses regular login)
  useEffect(() => {
    if (notaIdFromUrl) {
      setLoadingNota(true);
      fetch(`/api/transactions/${notaIdFromUrl}`)
        .then(async (res) => {
          if (!res.ok) {
            throw new Error('Nota transaksi tidak ditemukan di server.');
          }
          const data = await res.json();
          setNotaData(data);
          setNotaError(null);
        })
        .catch((err) => {
          setNotaError(err.message || 'Gagal memuat detail nota.');
        })
        .finally(() => {
          setLoadingNota(false);
        });
    }
  }, [notaIdFromUrl]);

  // 3. Sync database real-time from server
  const doDataSync = async (silent = false) => {
    if (!silent) setIsSyncing(true);
    try {
      // Sync products first
      const updatedProducts = await syncProductsFromServer();
      setProducts(updatedProducts);

      // Sync transactions next
      const updatedTransactions = await syncTransactionsFromServer();
      setTransactions(updatedTransactions);
    } catch (err) {
      console.error('Data synchronization failed:', err);
    } finally {
      if (!silent) setIsSyncing(false);
      setLoading(false);
    }
  };

  // Perform initial database open & sync, then configure 5-second interval
  useEffect(() => {
    // Open DB and execute initial sync
    initIndexedDB().then(() => {
      doDataSync();
    });

    // Real-time synchronization polling every 5 seconds to ensure cross-device consistency
    const interval = setInterval(() => {
      doDataSync(true);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Format money helper
  const formatRupiah = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value);
  };

  // 4. Handles login / registration
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!loginEmail) {
      setLoginError('Email wajib diisi.');
      return;
    }

    setIsLoggingIn(true);
    setLoginError('');

    try {
      const emailClean = loginEmail.trim().toLowerCase();

      // Check if user is trying to log in as admin but has selected buyer role
      if (emailClean === 'meythadaning05@gmail.com' && loginRole === 'buyer') {
        throw new Error('Email ini terdaftar sebagai Admin. Silakan pilih tab "Masuk Admin" di atas.');
      }

      // If user is buyer and action is 'login' (not 'register'), check if the account exists
      if (loginRole === 'buyer' && buyerAction === 'login') {
        const buyersRes = await fetch('/api/buyers');
        if (buyersRes.ok) {
          const buyersList = await buyersRes.json();
          const exists = buyersList.some((b: any) => b.email.toLowerCase() === emailClean);
          if (!exists) {
            throw new Error('Email Anda belum terdaftar. Silakan daftar terlebih dahulu melalui tab "Daftar Baru".');
          }
        }
      }

      // If action is 'register' and user forgot to enter name
      if (loginRole === 'buyer' && buyerAction === 'register' && !loginNama) {
        throw new Error('Nama Lengkap wajib diisi untuk pendaftaran baru.');
      }

      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail,
          password: loginRole === 'admin' ? loginPassword : '',
          nama: loginRole === 'buyer' && buyerAction === 'register' ? loginNama : ''
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Gagal melakukan login');
      }

      const loggedUser: LoggedInUser = await response.json();
      setUser(loggedUser);
      localStorage.setItem('boutique_user', JSON.stringify(loggedUser));
      
      // Clear forms
      setLoginEmail('');
      setLoginNama('');
      setLoginPassword('');
      
      // Re-fetch database to align with roles
      doDataSync();
    } catch (err: any) {
      setLoginError(err.message || 'Terjadi kesalahan saat masuk.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handles simulated Google login choice
  const handleGoogleLoginSelect = async (email: string, name: string) => {
    setGoogleLoading(true);
    setLoginError('');
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          nama: name
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Gagal masuk lewat Google');
      }

      const loggedUser: LoggedInUser = await response.json();
      setUser(loggedUser);
      localStorage.setItem('boutique_user', JSON.stringify(loggedUser));
      
      // Clear forms & modal
      setLoginEmail('');
      setLoginNama('');
      setLoginPassword('');
      setShowGoogleModal(false);
      setShowGoogleCustomInput(false);
      setGoogleCustomEmail('');
      setGoogleCustomName('');
      
      // Re-fetch database to align with roles
      doDataSync();
    } catch (err: any) {
      setLoginError(err.message || 'Terjadi kesalahan saat masuk dengan Google.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('boutique_user');
    setCart([]);
    setPosCart([]);
    setCurrentView('Beranda');
  };

  // 5. Buyer cart operations
  const handleAddToCart = (product: Product) => {
    const size = selectedSizes[product.id] || product.ukuran[0] || 'All Size';
    
    setCart(prevCart => {
      const existingIndex = prevCart.findIndex(
        item => item.product.id === product.id && item.selectedSize === size
      );

      if (existingIndex > -1) {
        const newCart = [...prevCart];
        const newQty = newCart[existingIndex].quantity + 1;
        if (newQty > product.stok) {
          alert(`Maaf, stok ${product.nama} tidak mencukupi untuk menambah kuantitas.`);
          return prevCart;
        }
        newCart[existingIndex].quantity = newQty;
        return newCart;
      } else {
        if (product.stok < 1) {
          alert(`Maaf, stok ${product.nama} habis.`);
          return prevCart;
        }
        return [...prevCart, { product, quantity: 1, selectedSize: size }];
      }
    });

    // Reset temporary size state for visual feedback
    alert(`Berhasil menambahkan ${product.nama} (${size}) ke keranjang belanja.`);
  };

  const updateCartQty = (index: number, delta: number) => {
    setCart(prevCart => {
      const item = prevCart[index];
      const newQty = item.quantity + delta;

      if (newQty <= 0) {
        // Remove item
        return prevCart.filter((_, idx) => idx !== index);
      }

      // Check stock limit
      if (newQty > item.product.stok) {
        alert(`Maaf, stok ${item.product.nama} hanya tersisa ${item.product.stok} pcs.`);
        return prevCart;
      }

      const newCart = [...prevCart];
      newCart[index].quantity = newQty;
      return newCart;
    });
  };

  const removeCartItem = (index: number) => {
    setCart(prevCart => prevCart.filter((_, idx) => idx !== index));
  };

  // Buyer Checkout via WhatsApp (connecting to +628996967565)
  const handleBuyerCheckout = async () => {
    if (!user) return;
    if (cart.length === 0) return;

    try {
      // 1. Create transaction in database
      const transaction = await checkoutTransaction(
        cart,
        user.nama,
        user.email,
        'Online'
      );

      // 2. Clear buyer cart locally
      setCart([]);
      setIsCartOpen(false);

      // 3. Format message and construct WhatsApp URL
      const boutiquePhone = '+628996967565';
      const orderItemsText = transaction.itemDibeli.map((item, idx) => {
        return `${idx + 1}. ${item.product.nama} (${item.selectedSize || 'Standard'}) - ${item.quantity}x @ ${formatRupiah(item.product.harga)}`;
      }).join('\n');

      const appUrl = window.location.origin;
      const invoiceLink = `${appUrl}/nota/${transaction.id}`;

      const waMessage = `Halo B&F Chic Boutique ✨
Saya ingin membeli produk pakaian/kecantikan berikut:

*Detail Pesanan (Nota No: ${transaction.id})*
${orderItemsText}

*Total Pembayaran:* ${formatRupiah(transaction.totalHarga)}
*Nama Pembeli:* ${transaction.pembeliNama}
*Email:* ${transaction.pembeliEmail}

Silakan cek detail nota online dan lakukan *Konfirmasi Pembayaran* di sini:
👉 ${invoiceLink}

Mohon konfirmasinya ya Sis, terima kasih banyak! 💕`;

      const encodedMessage = encodeURIComponent(waMessage);
      const waUrl = `https://wa.me/628996967565?text=${encodedMessage}`;

      // Open WhatsApp in new tab
      window.open(waUrl, '_blank');

      // Refresh database
      doDataSync();

      // Switch to beranda & notify
      alert(`Checkout sukses! Anda akan diarahkan ke WhatsApp untuk mengirimkan nota pesanan ke penjual.`);
    } catch (err: any) {
      alert(`Terjadi kesalahan saat checkout: ${err.message}`);
    }
  };

  // 6. Online Nota Invoice actions
  const handleConfirmInvoicePayment = async () => {
    if (!notaData) return;

    try {
      const updatedTrans = await confirmOnlinePayment(notaData.id);
      setNotaData(updatedTrans);

      // Generate WhatsApp text to inform successful payment
      const waMessage = `Halo B&F Chic Boutique ✨
Saya telah melakukan pembayaran dan mengonfirmasi transfer untuk pesanan saya!

*Nota No:* ${notaData.id}
*Total Transaksi:* ${formatRupiah(notaData.totalHarga)}
*Nama:* ${notaData.pembeliNama}

Status pembayaran di sistem telah berubah menjadi *Pembayaran Sukses*. Mohon diproses pengiriman barangnya ya Sis! Terima kasih banyak 💕

Link Nota Online:
👉 ${window.location.origin}/nota/${notaData.id}`;

      const encodedMessage = encodeURIComponent(waMessage);
      const waUrl = `https://wa.me/628996967565?text=${encodedMessage}`;

      // Redirect to WhatsApp
      window.open(waUrl, '_blank');
      alert('Konfirmasi pembayaran berhasil disimpan di database! Stok produk otomatis terpotong. Mengarahkan Anda kembali ke WhatsApp penjual.');
    } catch (err: any) {
      alert(`Gagal konfirmasi pembayaran: ${err.message}`);
    }
  };

  // 7. POS Actions (Admin Cashier Panel)
  const handleAddToPosCart = (product: Product) => {
    const size = product.ukuran[0] || 'All Size';
    
    setPosCart(prevCart => {
      const existingIndex = prevCart.findIndex(
        item => item.product.id === product.id && item.selectedSize === size
      );

      if (existingIndex > -1) {
        const newCart = [...prevCart];
        const newQty = newCart[existingIndex].quantity + 1;
        if (newQty > product.stok) {
          alert('Kuantitas melebihi stok yang tersedia.');
          return prevCart;
        }
        newCart[existingIndex].quantity = newQty;
        return newCart;
      } else {
        if (product.stok < 1) {
          alert('Stok produk habis.');
          return prevCart;
        }
        return [...prevCart, { product, quantity: 1, selectedSize: size }];
      }
    });
  };

  const updatePosCartQty = (index: number, delta: number) => {
    setPosCart(prevCart => {
      const item = prevCart[index];
      const newQty = item.quantity + delta;

      if (newQty <= 0) {
        return prevCart.filter((_, idx) => idx !== index);
      }

      if (newQty > item.product.stok) {
        alert('Stok tidak mencukupi.');
        return prevCart;
      }

      const newCart = [...prevCart];
      newCart[index].quantity = newQty;
      return newCart;
    });
  };

  const handlePosCheckout = async () => {
    if (posCart.length === 0) return;

    try {
      const transaction = await checkoutTransaction(
        posCart,
        'Pelanggan Kasir Walk-in',
        'walkin@boutique.com',
        'Kasir'
      );

      setPosCart([]);
      doDataSync();

      // Show invoice instantly for printing/completion
      setSelectedTransaction(transaction);
      alert('Transaksi Kasir berhasil disimpan! Nota kasir siap dicetak.');
    } catch (err: any) {
      alert(`Gagal memproses transaksi kasir: ${err.message}`);
    }
  };

  // 8. Admin CRUD Actions for Products
  const openAddProductModal = () => {
    setEditingProduct(null);
    setProductForm({
      nama: '',
      harga: 0,
      stok: 0,
      kategori: 'Pakaian',
      urlGambar: '',
      keterangan: '',
      ukuranText: 'S, M, L, XL, XXL (Big Size)'
    });
    setFormError('');
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      nama: product.nama,
      harga: product.harga,
      stok: product.stok,
      kategori: product.kategori,
      urlGambar: product.urlGambar,
      keterangan: product.keterangan || '',
      ukuranText: product.ukuran.join(', ')
    });
    setFormError('');
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: FormEvent) => {
    e.preventDefault();
    const { nama, harga, stok, kategori, urlGambar, keterangan, ukuranText } = productForm;

    if (!nama.trim() || harga <= 0 || stok < 0) {
      setFormError('Semua kolom wajib diisi dengan benar.');
      return;
    }

    const sizesArray = ukuranText
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const payload = {
      nama: nama.trim(),
      harga: Number(harga),
      stok: Number(stok),
      kategori,
      urlGambar: urlGambar.trim() || undefined,
      keterangan: keterangan.trim() || undefined,
      ukuran: sizesArray.length > 0 ? sizesArray : ["All Size"]
    };

    try {
      if (editingProduct) {
        await editProduct(editingProduct.id, payload);
      } else {
        await createProduct(payload);
      }
      setIsProductModalOpen(false);
      doDataSync();
      alert(`Produk berhasil ${editingProduct ? 'diperbarui' : 'ditambahkan'}!`);
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan produk.');
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus produk "${name}" dari database?`)) {
      try {
        await removeProduct(id);
        doDataSync();
        alert('Produk berhasil dihapus.');
      } catch (err: any) {
        alert(`Gagal menghapus produk: ${err.message}`);
      }
    }
  };

  // Filter products for Catalog search
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchSearch = product.nama.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          product.keterangan.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = categoryFilter === 'Semua' || product.kategori === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [products, searchQuery, categoryFilter]);

  // Filter products for Kasir (POS) search
  const filteredPosProducts = useMemo(() => {
    return products.filter(product => {
      const matchSearch = product.nama.toLowerCase().includes(posSearchQuery.toLowerCase());
      const matchCategory = posCategoryFilter === 'Semua' || product.kategori === posCategoryFilter;
      return matchSearch && matchCategory;
    });
  }, [products, posSearchQuery, posCategoryFilter]);

  // Total earnings count (Admin Dashboard)
  const dashboardStats = useMemo(() => {
    const activeProducts = products.length;
    const successTransactions = transactions.filter(t => t.statusPembayaran === 'Pembayaran Sukses');
    const totalEarnings = successTransactions.reduce((sum, t) => sum + t.totalHarga, 0);
    const totalOrders = transactions.length;

    return {
      activeProducts,
      totalEarnings,
      totalOrders,
      successCount: successTransactions.length,
      pendingCount: transactions.filter(t => t.statusPembayaran === 'Pending').length
    };
  }, [products, transactions]);

  // If viewing Nota directly from URL
  if (notaIdFromUrl) {
    return (
      <div id="nota-view-container" className="min-h-screen bg-neutral-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-amber-100">
          {loadingNota ? (
            <div className="flex flex-col items-center justify-center py-20">
              <RefreshCw className="h-12 w-12 text-rose-900 animate-spin mb-4" />
              <p className="text-neutral-600 font-medium font-serif">Mencari Nota Transaksi...</p>
            </div>
          ) : notaError || !notaData ? (
            <div className="p-8 text-center">
              <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-serif text-neutral-800 font-bold mb-2">Nota Tidak Ditemukan</h2>
              <p className="text-neutral-500 mb-6">{notaError || 'Detail nota belanja tidak dapat dimuat.'}</p>
              <button 
                onClick={() => window.location.href = '/'}
                className="px-6 py-2 bg-rose-900 text-white rounded-xl hover:bg-rose-800 transition-colors"
              >
                Ke Halaman Utama
              </button>
            </div>
          ) : (
            <div>
              {/* Receipt Header Banner */}
              <div className="bg-gradient-to-r from-rose-900 to-rose-950 text-white p-8 text-center relative">
                <div className="absolute top-4 right-4 flex items-center gap-2 bg-amber-500 text-neutral-900 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                  {notaData.statusPembayaran}
                </div>
                <div className="flex justify-center mb-3">
                  <div className="bg-amber-100 text-rose-900 p-3 rounded-full">
                    <Sparkles className="h-7 w-7" />
                  </div>
                </div>
                <h1 className="text-3xl font-serif font-bold tracking-wide">B&F Chic Boutique</h1>
                <p className="text-amber-200 text-sm mt-1 tracking-widest font-mono">SIMPLE & ELEGANT WOMEN BEAUTY</p>
                <p className="text-xs text-neutral-300 mt-2">WhatsApp Penjual: +62 899-6967-565</p>
              </div>

              {/* Receipt Details */}
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4 text-sm border-b border-dashed border-neutral-200 pb-6">
                  <div>
                    <span className="text-neutral-400 block text-xs uppercase font-semibold">Nota ID</span>
                    <span className="font-mono text-neutral-800 font-semibold">{notaData.id}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-neutral-400 block text-xs uppercase font-semibold">Tanggal Pembelian</span>
                    <span className="text-neutral-800 font-medium">
                      {new Date(notaData.tanggal).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block text-xs uppercase font-semibold">Nama Pembeli</span>
                    <span className="text-neutral-800 font-semibold">{notaData.pembeliNama}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-neutral-400 block text-xs uppercase font-semibold">Email Pembeli</span>
                    <span className="text-neutral-800 font-medium">{notaData.pembeliEmail}</span>
                  </div>
                </div>

                {/* Items Purchased Table */}
                <div>
                  <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wider mb-3">Item Yang Dibeli</h3>
                  <div className="space-y-3">
                    {notaData.itemDibeli.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                        <div className="flex items-center gap-3">
                          <img 
                            src={item.product.urlGambar} 
                            alt={item.product.nama} 
                            className="w-12 h-12 object-cover rounded-lg border border-neutral-200"
                          />
                          <div>
                            <h4 className="font-medium text-neutral-800 text-sm">{item.product.nama}</h4>
                            <div className="flex gap-2 text-xs text-neutral-500 mt-1">
                              <span>Ukuran: <strong className="text-neutral-700">{item.selectedSize || 'All Size'}</strong></span>
                              <span>•</span>
                              <span>Kategori: <strong>{item.product.kategori}</strong></span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-neutral-800 font-bold text-sm block">
                            {formatRupiah(item.product.harga * item.quantity)}
                          </span>
                          <span className="text-xs text-neutral-400">
                            {item.quantity} x {formatRupiah(item.product.harga)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Grand Total */}
                <div className="bg-rose-50 rounded-2xl p-4 flex justify-between items-center border border-rose-100">
                  <div>
                    <span className="text-rose-900 font-semibold text-sm">Total Tagihan</span>
                    <span className="text-neutral-400 block text-xs">Termasuk Pajak & Layanan</span>
                  </div>
                  <span className="text-2xl font-serif font-black text-rose-950">
                    {formatRupiah(notaData.totalHarga)}
                  </span>
                </div>

                {/* Payment status and notification info */}
                <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800 space-y-1">
                    <p className="font-bold">Informasi Status Pembayaran:</p>
                    {notaData.statusPembayaran === 'Pending' ? (
                      <p>Silakan klik tombol <strong>Konfirmasi Pembayaran</strong> di bawah ini setelah melakukan transfer agar pembayaran divalidasi oleh sistem dan stok otomatis berkurang.</p>
                    ) : (
                      <p className="text-green-800 font-semibold">Terima kasih! Pembayaran Anda sukses divalidasi. Stok barang otomatis dipotong dari inventory.</p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button 
                    onClick={() => window.print()}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border-2 border-rose-900 text-rose-900 rounded-xl hover:bg-rose-50 font-semibold transition-colors"
                  >
                    <Printer className="h-5 w-5" />
                    Cetak Nota Online
                  </button>

                  {notaData.statusPembayaran === 'Pending' ? (
                    <button 
                      onClick={handleConfirmInvoicePayment}
                      className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-rose-900 text-white rounded-xl hover:bg-rose-800 font-semibold shadow-lg shadow-rose-900/10 transition-colors"
                    >
                      <Check className="h-5 w-5" />
                      Konfirmasi Pembayaran
                    </button>
                  ) : (
                    <div className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-green-700 text-white rounded-xl font-semibold shadow-md cursor-default">
                      <CheckCircle className="h-5 w-5" />
                      Pembayaran Sukses
                    </div>
                  )}
                </div>

                <div className="text-center">
                  <button 
                    onClick={() => window.location.href = '/'}
                    className="text-xs text-neutral-400 hover:text-rose-900 transition-colors underline"
                  >
                    Masuk ke Toko B&F Chic Boutique
                  </button>
                </div>
              </div>

              <div className="bg-neutral-50 p-4 border-t border-dashed border-neutral-200 text-center text-xs text-neutral-400">
                Terima kasih telah berbelanja di B&F Chic Boutique • Stay Beautiful, Stay Elegant
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // If no user is logged in, render the login screen
  if (!user) {
    return (
      <div id="login-screen-container" className="min-h-screen bg-neutral-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Decorative background glow elements */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-rose-200/40 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-amber-100/40 blur-3xl pointer-events-none"></div>

        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100/80 z-10 transition-all duration-300">
          <div className="bg-gradient-to-r from-rose-900 to-rose-950 p-8 text-center text-white relative">
            <div className="flex justify-center mb-4">
              <div className="bg-amber-100 text-rose-900 p-4 rounded-full shadow-md animate-bounce duration-1000">
                <Sparkles className="h-8 w-8" />
              </div>
            </div>
            <h1 className="text-3xl font-serif font-black tracking-wide">B&F Chic Boutique</h1>
            <p className="text-amber-200 text-xs tracking-widest font-semibold uppercase mt-1">Simple but Elegant</p>
            <p className="text-neutral-300 text-sm mt-3 font-medium">Masuk untuk menjelajahi pakaian cantik dan produk kecantikan wanita</p>
          </div>

          <div className="p-8">
            {/* 1. Main Role Tabs */}
            <div className="flex border-b border-neutral-100 mb-6">
              <button
                type="button"
                onClick={() => {
                  setLoginRole('buyer');
                  setLoginError('');
                }}
                className={`flex-1 pb-3 text-sm font-bold text-center border-b-2 transition-all ${
                  loginRole === 'buyer' 
                    ? 'border-rose-900 text-rose-900' 
                    : 'border-transparent text-neutral-400 hover:text-neutral-600'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <User className="h-4 w-4" />
                  Pelanggan
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginRole('admin');
                  setLoginError('');
                }}
                className={`flex-1 pb-3 text-sm font-bold text-center border-b-2 transition-all ${
                  loginRole === 'admin' 
                    ? 'border-rose-900 text-rose-900' 
                    : 'border-transparent text-neutral-400 hover:text-neutral-600'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Lock className="h-4 w-4" />
                  Pemilik / Admin
                </div>
              </button>
            </div>

            {/* 2. Customer Auth Type Selection (Only for Buyer) */}
            {loginRole === 'buyer' && (
              <div className="flex bg-neutral-100/80 p-1 rounded-xl mb-5 border border-neutral-200/30">
                <button
                  type="button"
                  onClick={() => {
                    setBuyerAction('login');
                    setLoginError('');
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    buyerAction === 'login'
                      ? 'bg-white text-rose-950 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  Masuk (Sudah Ada Akun)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBuyerAction('register');
                    setLoginError('');
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    buyerAction === 'register'
                      ? 'bg-white text-rose-950 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  Daftar Baru
                </button>
              </div>
            )}

            {/* 3. Social Sign-In (Only for Buyer) */}
            {loginRole === 'buyer' && (
              <div className="mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setLoginError('');
                    setShowGoogleModal(true);
                  }}
                  className="w-full py-3 px-4 bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-200 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-3 active:scale-98 cursor-pointer"
                >
                  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.62-.62-1.07-1.42-1.21-2.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Masuk dengan Google</span>
                </button>
                <div className="flex items-center my-4">
                  <div className="flex-grow border-t border-neutral-100"></div>
                  <span className="px-3 text-[10px] text-neutral-400 font-bold uppercase tracking-widest bg-white">atau email</span>
                  <div className="flex-grow border-t border-neutral-100"></div>
                </div>
              </div>
            )}

            {/* 4. Form Submission */}
            <form onSubmit={handleLogin} className="space-y-4">
              {loginRole === 'buyer' ? (
                buyerAction === 'login' ? (
                  /* Buyer Login Form */
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Alamat Email Anda</label>
                    <input 
                      type="email" 
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="Masukkan email terdaftar (misal: meyta@example.com)"
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-900 focus:bg-white text-neutral-800 transition-all font-medium"
                      required
                    />
                  </div>
                ) : (
                  /* Buyer Registration Form */
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Nama Lengkap</label>
                      <input 
                        type="text" 
                        value={loginNama}
                        onChange={(e) => setLoginNama(e.target.value)}
                        placeholder="Nama lengkap Anda (misal: Meytha Daning)"
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-900 focus:bg-white text-neutral-800 transition-all font-medium"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Alamat Email</label>
                      <input 
                        type="email" 
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="Email untuk akun baru Anda"
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-900 focus:bg-white text-neutral-800 transition-all font-medium"
                        required
                      />
                    </div>
                  </div>
                )
              ) : (
                /* Admin Login Form */
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Email Admin</label>
                    <input 
                      type="email" 
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="meythadaning05@gmail.com"
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-900 focus:bg-white text-neutral-800 transition-all font-medium"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Password Admin</label>
                    <input 
                      type="password" 
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Masukkan password keamanan"
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-900 focus:bg-white text-neutral-800 transition-all font-medium"
                      required
                    />
                  </div>
                </div>
              )}

              {loginError && (
                <div className="p-3 bg-rose-50 text-rose-900 rounded-xl text-xs font-semibold flex items-center gap-2 border border-rose-100 animate-pulse">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <button 
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-3.5 px-4 bg-rose-900 hover:bg-rose-800 text-white rounded-xl font-bold uppercase tracking-wider shadow-lg shadow-rose-900/10 transition-colors flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                {isLoggingIn ? (
                  <RefreshCw className="h-5 w-5 animate-spin" />
                ) : (
                  <span>
                    {loginRole === 'admin' 
                      ? 'Masuk Sebagai Admin 🔐' 
                      : buyerAction === 'login' 
                        ? 'Masuk Ke Toko ✨' 
                        : 'Daftar & Masuk ✨'}
                  </span>
                )}
              </button>
            </form>

            <div className="mt-8 border-t border-neutral-100 pt-6 text-center text-xs text-neutral-400">
              <p>© 2026 B&F Chic Boutique • Indonesia</p>
            </div>
          </div>
        </div>

        {/* Google Sign-In Simulation Modal */}
        {showGoogleModal && (
          <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-neutral-100/80 animate-in fade-in zoom-in-95 duration-150">
              <div className="text-center pb-4 border-b border-neutral-100 relative">
                <div className="flex justify-center mb-2">
                  <svg className="h-8 w-8" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.62-.62-1.07-1.42-1.21-2.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                </div>
                <h2 className="text-base font-black text-neutral-800">Masuk dengan Google</h2>
                <p className="text-xs text-neutral-500 mt-1">Pilih akun untuk melanjutkan ke B&F Chic</p>
                
                <button 
                  type="button"
                  onClick={() => {
                    setShowGoogleModal(false);
                    setShowGoogleCustomInput(false);
                  }}
                  className="absolute top-0 right-0 text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {googleLoading ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-3">
                  <RefreshCw className="h-8 w-8 text-rose-900 animate-spin" />
                  <p className="text-xs font-semibold text-neutral-600">Menghubungkan ke Google...</p>
                </div>
              ) : (
                <div className="py-4 space-y-3">
                  {!showGoogleCustomInput ? (
                    <>
                      {/* Real user option from metadata */}
                      <button
                        type="button"
                        onClick={() => handleGoogleLoginSelect('mhafizarrasyid37@gmail.com', 'M. Hafiz Arrasyid')}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-rose-50/50 transition-all border border-neutral-100 text-left group cursor-pointer"
                      >
                        <div className="w-9 h-9 rounded-full bg-rose-900 text-white font-bold flex items-center justify-center shrink-0 shadow-sm text-sm">
                          MH
                        </div>
                        <div className="overflow-hidden flex-1">
                          <p className="text-xs font-bold text-neutral-800 group-hover:text-rose-900 transition-colors truncate">M. Hafiz Arrasyid</p>
                          <p className="text-[11px] text-neutral-500 truncate">mhafizarrasyid37@gmail.com</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-neutral-400 group-hover:translate-x-1 transition-transform" />
                      </button>

                      {/* Default guest user option */}
                      <button
                        type="button"
                        onClick={() => handleGoogleLoginSelect('customer@chicboutique.com', 'Pelanggan Cantik')}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-rose-50/50 transition-all border border-neutral-100 text-left group cursor-pointer"
                      >
                        <div className="w-9 h-9 rounded-full bg-amber-100 text-rose-900 font-bold flex items-center justify-center shrink-0 shadow-sm text-sm">
                          PC
                        </div>
                        <div className="overflow-hidden flex-1">
                          <p className="text-xs font-bold text-neutral-800 group-hover:text-rose-900 transition-colors truncate">Pelanggan Cantik</p>
                          <p className="text-[11px] text-neutral-500 truncate">customer@chicboutique.com</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-neutral-400 group-hover:translate-x-1 transition-transform" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowGoogleCustomInput(true)}
                        className="w-full py-2.5 px-3 text-center text-xs text-rose-900 font-bold hover:bg-rose-50 transition-colors rounded-xl border border-dashed border-rose-200 cursor-pointer"
                      >
                        + Gunakan Akun Google Lain
                      </button>
                    </>
                  ) : (
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (googleCustomEmail && googleCustomName) {
                          handleGoogleLoginSelect(googleCustomEmail, googleCustomName);
                        }
                      }}
                      className="space-y-4"
                    >
                      <div>
                        <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1">Nama Profil Google</label>
                        <input 
                          type="text"
                          value={googleCustomName}
                          onChange={(e) => setGoogleCustomName(e.target.value)}
                          placeholder="Nama Lengkap Anda"
                          className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-rose-900 text-neutral-800"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1">Email Google</label>
                        <input 
                          type="email"
                          value={googleCustomEmail}
                          onChange={(e) => setGoogleCustomEmail(e.target.value)}
                          placeholder="nama@gmail.com"
                          className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-rose-900 text-neutral-800"
                          required
                        />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowGoogleCustomInput(false)}
                          className="flex-1 py-2 text-xs font-bold text-neutral-500 hover:bg-neutral-100 rounded-xl transition-colors border border-neutral-200 cursor-pointer"
                        >
                          Kembali
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-2 text-xs font-bold text-white bg-rose-900 hover:bg-rose-800 rounded-xl transition-colors cursor-pointer"
                        >
                          Hubungkan
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col font-sans">
      
      {/* 1. TOP HEADER NAVIGATION */}
      <header className="bg-neutral-900 text-white shadow-md sticky top-0 z-40 px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-1.5 hover:bg-neutral-800 rounded-lg lg:hidden transition-colors"
          >
            <Menu className="h-6 w-6" />
          </button>
          
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentView('Beranda')}>
            <div className="bg-amber-400 text-neutral-900 p-2 rounded-xl">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-serif font-bold text-lg sm:text-xl tracking-wide">B&F Chic Boutique</h1>
              <p className="text-[10px] text-amber-300 font-semibold tracking-wider uppercase hidden sm:block">Women Beauty & Fashion</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Synchronized status label indicator */}
          <div className="hidden md:flex items-center gap-1.5 text-xs text-neutral-400">
            <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span>
            <span>Tersambung Real-Time</span>
          </div>

          {/* User Name Badge next to cart */}
          <div className="bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 border border-neutral-700">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
            <span>{user.nama}</span>
          </div>

          {/* Admin panel quick badge indicator */}
          {user.role === 'admin' && (
            <div className="bg-rose-950 text-amber-300 px-3 py-1.5 rounded-full text-xs font-bold border border-rose-800 uppercase hidden sm:block">
              Admin Mode
            </div>
          )}

          {/* Shopping Cart Trigger Icon for Buyer */}
          {user.role === 'buyer' && (
            <button 
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 hover:bg-neutral-800 rounded-full transition-colors flex items-center justify-center border border-neutral-700"
            >
              <ShoppingBag className="h-5 w-5 text-amber-300" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-600 text-white font-bold text-2xs w-5 h-5 rounded-full flex items-center justify-center border border-neutral-900">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              )}
            </button>
          )}

          {/* Logout Button in Header */}
          <button 
            onClick={handleLogout}
            className="p-2 hover:bg-rose-950 hover:text-red-400 text-neutral-400 rounded-full transition-colors hidden md:block"
            title="Keluar Akun"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER LAYOUT */}
      <div className="flex-1 flex relative">
        
        {/* 2. SIDEBAR - PERSISTENT ON DESKTOP, FLOATING ON MOBILE */}
        {/* Sidebar Overlay for Mobile */}
        {isMobileSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-50 lg:hidden"
            onClick={() => setIsMobileSidebarOpen(false)}
          ></div>
        )}

        <aside className={`
          fixed lg:static inset-y-0 left-0 bg-white text-neutral-800 border-r border-neutral-200 w-64 z-50 transform lg:transform-none transition-transform duration-300 ease-in-out flex flex-col justify-between shadow-lg lg:shadow-none
          ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between lg:hidden border-b pb-4">
              <span className="font-serif font-bold text-neutral-800">Menu Navigasi</span>
              <button 
                onClick={() => setIsMobileSidebarOpen(false)}
                className="p-1 hover:bg-neutral-100 rounded-lg"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* User Intro */}
            <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
              <span className="text-xs text-neutral-400 uppercase font-bold block">Selamat Datang</span>
              <span className="text-sm font-bold text-neutral-800 block truncate">{user.nama}</span>
              <span className="text-[10px] bg-rose-100 text-rose-900 px-2 py-0.5 rounded-full font-semibold inline-block mt-1 uppercase tracking-wider">
                {user.role === 'admin' ? 'Pemilik Butik' : 'Pelanggan'}
              </span>
            </div>

            {/* Sidebar Navigation Items */}
            <nav className="space-y-1.5">
              <button 
                onClick={() => { setCurrentView('Beranda'); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all
                  ${currentView === 'Beranda' ? 'bg-rose-900 text-white shadow-md' : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'}
                `}
              >
                <Home className="h-4.5 w-4.5" />
                <span>Beranda Toko</span>
              </button>

              <button 
                onClick={() => { setCurrentView('Katalog'); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all
                  ${currentView === 'Katalog' ? 'bg-rose-900 text-white shadow-md' : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'}
                `}
              >
                <ShoppingBag className="h-4.5 w-4.5" />
                <span>Katalog Produk</span>
              </button>

              {/* ADMIN PANEL ONLY NAV */}
              {user.role === 'admin' && (
                <div className="pt-4 mt-4 border-t border-neutral-100 space-y-1.5">
                  <span className="px-4 text-2xs font-extrabold text-neutral-400 uppercase tracking-widest block mb-2">Admin Panel</span>
                  
                  <button 
                    onClick={() => { setCurrentView('KelolaProduk'); setIsMobileSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all
                      ${currentView === 'KelolaProduk' ? 'bg-amber-500 text-neutral-900 shadow-sm font-semibold' : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'}
                    `}
                  >
                    <Edit2 className="h-4.5 w-4.5" />
                    <span>Kelola Produk</span>
                  </button>

                  <button 
                    onClick={() => { setCurrentView('Kasir'); setIsMobileSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all
                      ${currentView === 'Kasir' ? 'bg-amber-500 text-neutral-900 shadow-sm font-semibold' : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'}
                    `}
                  >
                    <DollarSign className="h-4.5 w-4.5" />
                    <span>Kasir / PoS</span>
                  </button>

                  <button 
                    onClick={() => { setCurrentView('Riwayat'); setIsMobileSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all
                      ${currentView === 'Riwayat' ? 'bg-amber-500 text-neutral-900 shadow-sm font-semibold' : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'}
                    `}
                  >
                    <ClipboardList className="h-4.5 w-4.5" />
                    <span>Riwayat Transaksi</span>
                  </button>
                </div>
              )}
            </nav>
          </div>

          <div className="p-6 border-t border-neutral-100">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-rose-200 text-rose-900 hover:bg-rose-50 rounded-xl text-sm font-semibold transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Log Out Akun</span>
            </button>
          </div>
        </aside>

        {/* 3. MAIN CONTENT CONTAINER */}
        <main className="flex-1 bg-neutral-50 p-4 sm:p-8 overflow-y-auto max-h-[calc(100vh-72px)]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <RefreshCw className="h-10 w-10 text-rose-900 animate-spin mb-3" />
              <p className="text-neutral-600 font-medium font-serif">Menyinkronkan data butik...</p>
            </div>
          ) : (
            <div>
              
              {/* ========================================================== */}
              {/* VIEW: BERANDA (DASHBOARD)                                  */}
              {/* ========================================================== */}
              {currentView === 'Beranda' && (
                <div id="beranda-view" className="space-y-8 animate-fade-in">
                  
                  {/* Hero Banner Section */}
                  <div className="bg-gradient-to-r from-rose-900 to-rose-950 rounded-3xl text-white p-8 sm:p-12 shadow-xl border border-rose-850 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                    <div className="absolute bottom-0 left-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl -ml-20 -mb-20"></div>

                    <div className="relative max-w-xl space-y-4">
                      <div className="inline-flex items-center gap-1.5 bg-amber-400 text-neutral-900 text-2xs font-extrabold uppercase px-3 py-1 rounded-full tracking-wider">
                        <Sparkles className="h-3.5 w-3.5" /> Best Boutique Collection
                      </div>
                      <h2 className="text-3xl sm:text-4xl font-serif font-black tracking-wide leading-tight">Simple Elegant Style for Your Beautiful Soul</h2>
                      <p className="text-neutral-200 text-sm leading-relaxed font-light">
                        Menghadirkan koleksi pakaian wanita premium yang dirancang khusus dari ukuran terkecil hingga bigsize, dipadukan dengan lini kosmetik kecantikan terbaik untuk pancaran pesona cantik Anda setiap hari.
                      </p>
                      <div className="pt-3 flex gap-4">
                        <button 
                          onClick={() => setCurrentView('Katalog')}
                          className="bg-amber-400 hover:bg-amber-300 text-neutral-900 font-bold text-sm px-6 py-3 rounded-xl transition-all flex items-center gap-2 shadow-md shadow-amber-400/10 cursor-pointer"
                        >
                          <span>Buka Katalog Belanja</span>
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ADMIN ANALYTICS DASHBOARD CARD SUMMARY */}
                  {user.role === 'admin' ? (
                    <div className="space-y-6">
                      <h3 className="font-serif font-black text-2xl text-neutral-800">Ringkasan Kinerja Butik</h3>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-sm flex items-center justify-between">
                          <div className="space-y-1">
                            <span className="text-xs text-neutral-400 uppercase font-extrabold block">Total Pendapatan</span>
                            <span className="text-2xl font-bold text-neutral-800 font-serif block">{formatRupiah(dashboardStats.totalEarnings)}</span>
                            <span className="text-[10px] text-green-600 font-semibold">Transaksi Sukses</span>
                          </div>
                          <div className="bg-green-50 text-green-600 p-3 rounded-xl">
                            <DollarSign className="h-6 w-6" />
                          </div>
                        </div>

                        <div className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-sm flex items-center justify-between">
                          <div className="space-y-1">
                            <span className="text-xs text-neutral-400 uppercase font-extrabold block">Jumlah Transaksi</span>
                            <span className="text-2xl font-bold text-neutral-800 font-serif block">{dashboardStats.totalOrders} Nota</span>
                            <span className="text-[10px] text-amber-600 font-semibold">{dashboardStats.pendingCount} Pending • {dashboardStats.successCount} Sukses</span>
                          </div>
                          <div className="bg-amber-50 text-amber-600 p-3 rounded-xl">
                            <ClipboardList className="h-6 w-6" />
                          </div>
                        </div>

                        <div className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-sm flex items-center justify-between">
                          <div className="space-y-1">
                            <span className="text-xs text-neutral-400 uppercase font-extrabold block">Total Produk Aktif</span>
                            <span className="text-2xl font-bold text-neutral-800 font-serif block">{dashboardStats.activeProducts} Produk</span>
                            <span className="text-[10px] text-neutral-400">Pakaian & Kecantikan</span>
                          </div>
                          <div className="bg-rose-50 text-rose-900 p-3 rounded-xl">
                            <ShoppingBag className="h-6 w-6" />
                          </div>
                        </div>

                        <div className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-sm flex items-center justify-between">
                          <div className="space-y-1">
                            <span className="text-xs text-neutral-400 uppercase font-extrabold block">Pelanggan Terdaftar</span>
                            <span className="text-2xl font-bold text-neutral-800 font-serif block">{transactions.map(t => t.pembeliEmail).filter((v, i, a) => a.indexOf(v) === i).length} Orang</span>
                            <span className="text-[10px] text-green-600 font-semibold">Aktif di Toko</span>
                          </div>
                          <div className="bg-neutral-50 text-neutral-600 p-3 rounded-xl">
                            <Users className="h-6 w-6" />
                          </div>
                        </div>
                      </div>

                      {/* Quick Links for Admin */}
                      <div className="bg-white rounded-3xl p-6 border border-neutral-100 shadow-sm">
                        <h4 className="font-serif font-bold text-lg text-neutral-800 mb-4">Akses Cepat Panel Kasir & Pengelolaan</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <button 
                            onClick={() => setCurrentView('KelolaProduk')}
                            className="bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-2xl p-4 text-left transition-colors flex items-center gap-3 cursor-pointer"
                          >
                            <div className="bg-rose-100 text-rose-900 p-2.5 rounded-xl">
                              <Edit2 className="h-5 w-5" />
                            </div>
                            <div>
                              <span className="font-bold text-sm text-neutral-800 block">Kelola Inventori</span>
                              <span className="text-xs text-neutral-400 block">Atur stok, harga, & gambar</span>
                            </div>
                          </button>

                          <button 
                            onClick={() => setCurrentView('Kasir')}
                            className="bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-2xl p-4 text-left transition-colors flex items-center gap-3 cursor-pointer"
                          >
                            <div className="bg-amber-100 text-amber-700 p-2.5 rounded-xl">
                              <DollarSign className="h-5 w-5" />
                            </div>
                            <div>
                              <span className="font-bold text-sm text-neutral-800 block">Buka Mesin POS</span>
                              <span className="text-xs text-neutral-400 block">Melayani walk-in kasir</span>
                            </div>
                          </button>

                          <button 
                            onClick={() => setCurrentView('Riwayat')}
                            className="bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-2xl p-4 text-left transition-colors flex items-center gap-3 cursor-pointer"
                          >
                            <div className="bg-neutral-100 text-neutral-700 p-2.5 rounded-xl">
                              <ClipboardList className="h-5 w-5" />
                            </div>
                            <div>
                              <span className="font-bold text-sm text-neutral-800 block">Laporan Penjualan</span>
                              <span className="text-xs text-neutral-400 block">Cek riwayat nota & status WA</span>
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // BUYER CONTENT
                    <div className="space-y-6">
                      <h3 className="font-serif font-black text-2xl text-neutral-800">Kategori Pilihan Khusus Untukmu</h3>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="bg-white rounded-3xl p-6 border border-neutral-100 shadow-sm flex flex-col justify-between space-y-6 relative overflow-hidden group">
                          <div className="space-y-2">
                            <span className="text-2xs bg-rose-100 text-rose-900 px-3 py-1 rounded-full font-bold uppercase tracking-wider">Simple & Elegant</span>
                            <h4 className="text-2xl font-serif font-bold text-neutral-800">Pakaian Wanita Premium</h4>
                            <p className="text-xs text-neutral-500 max-w-sm">
                              Dari Dress satin silk, Blazer, hingga Rok plisket dengan ragas pilihan size bervariasi mulai dari kecil hingga Big Size (XXL / Jumbo). Nyaman dipakai dengan bahan bermutu tinggi.
                            </p>
                          </div>
                          <div>
                            <button 
                              onClick={() => { setCategoryFilter('Pakaian'); setCurrentView('Katalog'); }}
                              className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold tracking-wider transition-colors"
                            >
                              Lihat Koleksi Pakaian
                            </button>
                          </div>
                        </div>

                        <div className="bg-white rounded-3xl p-6 border border-neutral-100 shadow-sm flex flex-col justify-between space-y-6 relative overflow-hidden group">
                          <div className="space-y-2">
                            <span className="text-2xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-bold uppercase tracking-wider">Pure & Radiant</span>
                            <h4 className="text-2xl font-serif font-bold text-neutral-800">Produk Kosmetik & Kecantikan</h4>
                            <p className="text-xs text-neutral-500 max-w-sm">
                              Serum Rose Glow, Matte Cushion SPF, Lip Oil Peach, dan Clay Mask alami untuk merawat kecantikan kulit wajahmu agar tetap cantik dan menawan alami.
                            </p>
                          </div>
                          <div>
                            <button 
                              onClick={() => { setCategoryFilter('Kecantikan'); setCurrentView('Katalog'); }}
                              className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold tracking-wider transition-colors"
                            >
                              Jelajahi Kosmetik
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Info Bar */}
                      <div className="bg-neutral-900 text-white p-6 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="space-y-1">
                          <h4 className="font-serif font-bold text-amber-300">Konsep Belanja Modern: Checkout langsung WA 💬</h4>
                          <p className="text-xs text-neutral-300 font-light">Pilih pakaian favorit Anda, tambahkan ke keranjang, dan kirim nota online otomatis ke penjual di nomor +62 899-6967-565!</p>
                        </div>
                        <button 
                          onClick={() => { setCategoryFilter('Semua'); setCurrentView('Katalog'); }}
                          className="bg-amber-400 hover:bg-amber-300 text-neutral-900 font-bold px-5 py-2.5 rounded-xl text-xs whitespace-nowrap transition-colors"
                        >
                          Mulai Berbelanja Sekarang
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ========================================================== */}
              {/* VIEW: KATALOG PRODUK                                        */}
              {/* ========================================================== */}
              {currentView === 'Katalog' && (
                <div id="katalog-view" className="space-y-6 animate-fade-in">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h2 className="font-serif font-black text-3xl text-neutral-800">Katalog Produk</h2>
                      <p className="text-xs text-neutral-500 mt-1">Saring dan pilih koleksi busana serta kosmetik unggulan kami</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => doDataSync()} 
                        disabled={isSyncing}
                        className="bg-white hover:bg-neutral-50 border border-neutral-200 p-2.5 rounded-xl shadow-sm transition-colors text-neutral-600 disabled:opacity-50"
                        title="Refresh Sinkronisasi"
                      >
                        <RefreshCw className={`h-4.5 w-4.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Search and Category Filters */}
                  <div className="bg-white rounded-3xl p-6 border border-neutral-100 shadow-sm flex flex-col sm:flex-row gap-4 items-center">
                    <div className="relative w-full sm:flex-1">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 h-5 w-5" />
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Cari pakaian, serum, blus, atau kosmetik..."
                        className="w-full pl-11 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-900 focus:bg-white text-sm text-neutral-800 font-medium transition-all"
                      />
                    </div>

                    {/* Category Filter Pills */}
                    <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                      {(['Semua', 'Pakaian', 'Kecantikan'] as const).map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setCategoryFilter(cat)}
                          className={`px-5 py-2.5 rounded-xl font-semibold text-xs tracking-wider transition-all whitespace-nowrap cursor-pointer
                            ${categoryFilter === cat 
                              ? 'bg-rose-900 text-white shadow-md' 
                              : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-600 border border-neutral-200'
                            }
                          `}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Catalog Products Grid */}
                  {filteredProducts.length === 0 ? (
                    <div className="bg-white rounded-3xl p-16 text-center border border-neutral-100 shadow-sm">
                      <ShoppingBag className="h-16 w-16 text-neutral-300 mx-auto mb-4" />
                      <h4 className="text-xl font-serif font-bold text-neutral-700">Produk Tidak Ditemukan</h4>
                      <p className="text-xs text-neutral-400 mt-1">Coba sesuaikan kata kunci pencarian atau kategori filter Anda.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {filteredProducts.map((product) => {
                        const hasStock = product.stok > 0;
                        const isClothing = product.kategori === 'Pakaian';
                        
                        return (
                          <div 
                            key={product.id}
                            className="bg-white rounded-3xl overflow-hidden border border-neutral-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
                          >
                            <div className="relative">
                              <img 
                                src={product.urlGambar} 
                                alt={product.nama} 
                                className="w-full h-56 object-cover bg-neutral-100"
                              />
                              <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-xs text-rose-950 font-bold text-2xs px-2.5 py-1 rounded-full uppercase tracking-wider border border-rose-100">
                                {product.kategori}
                              </div>
                              {!hasStock && (
                                <div className="absolute inset-0 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center">
                                  <span className="bg-red-600 text-white font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-xl">Stok Habis</span>
                                </div>
                              )}
                            </div>

                            <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                              <div className="space-y-1.5">
                                <h3 className="font-serif font-bold text-neutral-800 text-base leading-snug line-clamp-1">{product.nama}</h3>
                                <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed min-h-[32px]">{product.keterangan}</p>
                                
                                {/* Available options preview based on category */}
                                <div className="flex flex-col gap-1.5 pt-1">
                                  <div className="text-2xs text-neutral-400 font-bold uppercase tracking-wider">
                                    {isClothing ? 'Ukuran Tersedia:' : 'Varian Shade:'}
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {product.ukuran.map((opt, i) => (
                                      <span key={i} className="text-3xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-md font-medium border border-neutral-150">
                                        {opt}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-3.5 pt-2 border-t border-neutral-100">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <span className="text-2xs text-neutral-400 block uppercase font-bold tracking-wider">Harga</span>
                                    <span className="text-lg font-bold text-rose-950 font-serif">
                                      {formatRupiah(product.harga)}
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-2xs text-neutral-400 block uppercase font-bold tracking-wider">Stok</span>
                                    <span className={`text-xs font-bold ${product.stok <= 5 ? 'text-amber-600' : 'text-neutral-700'}`}>
                                      {product.stok} pcs
                                    </span>
                                  </div>
                                </div>

                                {/* Size select element specifically for buyers ordering clothes */}
                                {user.role === 'buyer' && hasStock && (
                                  <div className="space-y-1">
                                    <label className="text-3xs text-neutral-400 font-bold uppercase block tracking-wider">Pilih Opsi Anda:</label>
                                    <select 
                                      value={selectedSizes[product.id] || product.ukuran[0] || 'All Size'}
                                      onChange={(e) => setSelectedSizes({...selectedSizes, [product.id]: e.target.value})}
                                      className="w-full text-xs px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-700 font-medium focus:outline-none focus:ring-1 focus:ring-rose-900"
                                    >
                                      {product.ukuran.map((size, index) => (
                                        <option key={index} value={size}>{size}</option>
                                      ))}
                                    </select>
                                  </div>
                                )}

                                {/* Add to Cart / Actions */}
                                {user.role === 'buyer' ? (
                                  <button
                                    onClick={() => handleAddToCart(product)}
                                    disabled={!hasStock}
                                    className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer
                                      ${hasStock 
                                        ? 'bg-rose-900 hover:bg-rose-800 text-white shadow-sm' 
                                        : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                                      }
                                    `}
                                  >
                                    <ShoppingBag className="h-4 w-4" />
                                    <span>Masukkan Keranjang</span>
                                  </button>
                                ) : (
                                  // Admin edit link
                                  <button
                                    onClick={() => openEditProductModal(product)}
                                    className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-neutral-900 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                    <span>Ubah Produk</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ========================================================== */}
              {/* VIEW: KELOLA PRODUK (ADMIN ONLY)                          */}
              {/* ========================================================== */}
              {user.role === 'admin' && currentView === 'KelolaProduk' && (
                <div id="kelola-produk-view" className="space-y-6 animate-fade-in">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h2 className="font-serif font-black text-3xl text-neutral-800">Kelola Inventori Produk</h2>
                      <p className="text-xs text-neutral-500 mt-1">Tambah, edit, atau hapus database produk B&F Chic Boutique</p>
                    </div>

                    <button 
                      onClick={openAddProductModal}
                      className="bg-rose-900 hover:bg-rose-800 text-white font-bold text-sm px-5 py-3 rounded-xl transition-colors flex items-center gap-2 shadow-md cursor-pointer"
                    >
                      <Plus className="h-4.5 w-4.5" />
                      <span>Tambah Produk Baru</span>
                    </button>
                  </div>

                  {/* Products Table Wrapper */}
                  <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-neutral-50 text-neutral-500 text-xs font-bold uppercase tracking-wider border-b border-neutral-200">
                            <th className="p-5">Gambar</th>
                            <th className="p-5">Nama Produk</th>
                            <th className="p-5">Kategori</th>
                            <th className="p-5">Pilihan Size/Varian</th>
                            <th className="p-5">Harga</th>
                            <th className="p-5">Stok</th>
                            <th className="p-5 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200 text-sm text-neutral-700">
                          {products.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-10 text-center text-neutral-400">
                                Belum ada data produk di database. Silakan tambah produk baru.
                              </td>
                            </tr>
                          ) : (
                            products.map((p) => (
                              <tr key={p.id} className="hover:bg-neutral-50 transition-colors">
                                <td className="p-5">
                                  <img 
                                    src={p.urlGambar} 
                                    alt={p.nama} 
                                    className="w-12 h-12 object-cover rounded-xl border border-neutral-200 bg-neutral-100"
                                  />
                                </td>
                                <td className="p-5">
                                  <div className="font-semibold text-neutral-800">{p.nama}</div>
                                  <div className="text-2xs text-neutral-400 line-clamp-1 mt-0.5">{p.keterangan}</div>
                                </td>
                                <td className="p-5">
                                  <span className={`px-2.5 py-1 rounded-full text-2xs font-semibold uppercase tracking-wider
                                    ${p.kategori === 'Pakaian' ? 'bg-rose-100 text-rose-900' : 'bg-amber-100 text-amber-900'}
                                  `}>
                                    {p.kategori}
                                  </span>
                                </td>
                                <td className="p-5">
                                  <div className="flex flex-wrap gap-1 max-w-[180px]">
                                    {p.ukuran.map((uk, idx) => (
                                      <span key={idx} className="text-3xs bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded font-mono border border-neutral-200">
                                        {uk}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="p-5 font-bold text-neutral-800">
                                  {formatRupiah(p.harga)}
                                </td>
                                <td className="p-5">
                                  <span className={`font-semibold text-xs ${p.stok <= 5 ? 'text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md' : 'text-neutral-700'}`}>
                                    {p.stok} pcs
                                  </span>
                                </td>
                                <td className="p-5 text-right space-x-1 whitespace-nowrap">
                                  <button 
                                    onClick={() => openEditProductModal(p)}
                                    className="p-1.5 text-neutral-500 hover:text-amber-600 hover:bg-neutral-100 rounded-lg transition-colors"
                                    title="Edit Produk"
                                  >
                                    <Edit2 className="h-4.5 w-4.5" />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteProduct(p.id, p.nama)}
                                    className="p-1.5 text-neutral-500 hover:text-red-600 hover:bg-neutral-100 rounded-lg transition-colors"
                                    title="Hapus Produk"
                                  >
                                    <Trash2 className="h-4.5 w-4.5" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================== */}
              {/* VIEW: KASIR / POS (ADMIN ONLY)                             */}
              {/* ========================================================== */}
              {user.role === 'admin' && currentView === 'Kasir' && (
                <div id="kasir-view" className="space-y-6 animate-fade-in">
                  <div>
                    <h2 className="font-serif font-black text-3xl text-neutral-800">Mesin Kasir / Point of Sale (POS)</h2>
                    <p className="text-xs text-neutral-500 mt-1">Layanan kasir cepat untuk transaksi pelanggan walk-in butik</p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* Left: Product Grid selection */}
                    <div className="lg:col-span-8 space-y-4">
                      
                      {/* POS search bar */}
                      <div className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center">
                        <div className="relative flex-1 w-full">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 h-4.5 w-4.5" />
                          <input 
                            type="text" 
                            value={posSearchQuery}
                            onChange={(e) => setPosSearchQuery(e.target.value)}
                            placeholder="Cari produk cepat..."
                            className="w-full pl-10 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none text-xs text-neutral-800 font-medium transition-all"
                          />
                        </div>

                        {/* Category filter POS */}
                        <div className="flex gap-1.5 w-full sm:w-auto">
                          {(['Semua', 'Pakaian', 'Kecantikan'] as const).map((cat) => (
                            <button
                              key={cat}
                              onClick={() => setPosCategoryFilter(cat)}
                              className={`px-3 py-1.5 rounded-lg font-bold text-3xs uppercase tracking-wider transition-all
                                ${posCategoryFilter === cat 
                                  ? 'bg-neutral-900 text-white' 
                                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                                }
                              `}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* POS Products Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filteredPosProducts.map((p) => {
                          const hasStock = p.stok > 0;
                          return (
                            <div 
                              key={p.id}
                              onClick={() => hasStock && handleAddToPosCart(p)}
                              className={`bg-white rounded-2xl p-4 border border-neutral-200 shadow-2xs cursor-pointer hover:border-amber-400 hover:shadow-md transition-all flex gap-3 items-start relative
                                ${!hasStock ? 'opacity-50 grayscale cursor-not-allowed' : ''}
                              `}
                            >
                              <img 
                                src={p.urlGambar} 
                                alt={p.nama} 
                                className="w-16 h-16 object-cover rounded-xl border border-neutral-100"
                              />
                              <div className="flex-1 min-w-0">
                                <span className="text-[10px] text-rose-900 font-bold uppercase">{p.kategori}</span>
                                <h4 className="font-serif font-bold text-neutral-800 text-xs truncate leading-snug">{p.nama}</h4>
                                <span className="text-xs font-extrabold text-rose-950 block mt-1">{formatRupiah(p.harga)}</span>
                                <span className={`text-3xs block mt-0.5 font-semibold ${p.stok <= 5 ? 'text-amber-600' : 'text-neutral-400'}`}>
                                  Stok: {p.stok} pcs
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right: Cashier Cart details */}
                    <div className="lg:col-span-4">
                      <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-6 sticky top-24 space-y-6">
                        <div className="border-b pb-4 flex justify-between items-center">
                          <h3 className="font-serif font-black text-lg text-neutral-800">Keranjang PoS</h3>
                          <span className="text-3xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full font-bold uppercase">Kasir Walk-in</span>
                        </div>

                        {posCart.length === 0 ? (
                          <div className="py-12 text-center text-neutral-400 space-y-2">
                            <ShoppingBag className="h-12 w-12 mx-auto text-neutral-200" />
                            <p className="text-xs">Keranjang PoS masih kosong.</p>
                            <p className="text-4xs uppercase tracking-widest text-neutral-400">Klik produk di kiri untuk menambahkan</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                              {posCart.map((item, index) => (
                                <div key={index} className="flex justify-between items-start bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                                  <div className="min-w-0 flex-1 pr-2">
                                    <h4 className="font-bold text-xs text-neutral-800 truncate">{item.product.nama}</h4>
                                    <span className="text-3xs text-rose-900 font-semibold block mt-0.5">{formatRupiah(item.product.harga)}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button 
                                      onClick={() => updatePosCartQty(index, -1)}
                                      className="p-1 hover:bg-neutral-200 rounded text-neutral-600"
                                    >
                                      <Minus className="h-3 w-3" />
                                    </button>
                                    <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                                    <button 
                                      onClick={() => updatePosCartQty(index, 1)}
                                      className="p-1 hover:bg-neutral-200 rounded text-neutral-600"
                                    >
                                      <Plus className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Total calculations */}
                            <div className="border-t border-dashed pt-4 space-y-2">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-neutral-400 font-semibold">Subtotal</span>
                                <span className="text-neutral-800 font-bold">
                                  {formatRupiah(posCart.reduce((sum, item) => sum + (item.product.harga * item.quantity), 0))}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-neutral-400 font-semibold">Diskon PoS</span>
                                <span className="text-green-600 font-bold">Rp 0</span>
                              </div>
                              <div className="flex justify-between items-center pt-2 border-t text-sm font-bold text-neutral-800">
                                <span>Total Pembayaran</span>
                                <span className="text-lg font-serif text-rose-950">
                                  {formatRupiah(posCart.reduce((sum, item) => sum + (item.product.harga * item.quantity), 0))}
                                </span>
                              </div>
                            </div>

                            <button 
                              onClick={handlePosCheckout}
                              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-neutral-900 font-black text-xs uppercase tracking-widest rounded-xl shadow-xs transition-colors cursor-pointer"
                            >
                              Proses Pembayaran Kasir
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================== */}
              {/* VIEW: RIWAYAT TRANSAKSI (ADMIN ONLY)                       */}
              {/* ========================================================== */}
              {user.role === 'admin' && currentView === 'Riwayat' && (
                <div id="riwayat-view" className="space-y-6 animate-fade-in">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="font-serif font-black text-3xl text-neutral-800">Riwayat Penjualan & Nota</h2>
                      <p className="text-xs text-neutral-500 mt-1">Daftar transaksi pelanggan baik walk-in kasir maupun pesanan online WhatsApp</p>
                    </div>

                    <button 
                      onClick={() => doDataSync()}
                      className="bg-white hover:bg-neutral-50 border border-neutral-200 px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 transition-colors flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span>Segarkan Data</span>
                    </button>
                  </div>

                  {/* Transaction History Table */}
                  <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-neutral-50 text-neutral-500 text-xs font-bold uppercase tracking-wider border-b border-neutral-200">
                            <th className="p-5">ID Nota</th>
                            <th className="p-5">Tanggal</th>
                            <th className="p-5">Pembeli</th>
                            <th className="p-5">Kanal</th>
                            <th className="p-5">Item</th>
                            <th className="p-5">Total Harga</th>
                            <th className="p-5">Status</th>
                            <th className="p-5 text-right">Nota Link</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200 text-sm text-neutral-700">
                          {transactions.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="p-10 text-center text-neutral-400">
                                Belum ada riwayat transaksi tersimpan.
                              </td>
                            </tr>
                          ) : (
                            transactions.map((t) => (
                              <tr key={t.id} className="hover:bg-neutral-50 transition-colors">
                                <td className="p-5 font-mono text-xs font-bold text-neutral-800">{t.id}</td>
                                <td className="p-5 text-xs text-neutral-500">
                                  {new Date(t.tanggal).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                                </td>
                                <td className="p-5">
                                  <div className="font-semibold text-neutral-800">{t.pembeliNama}</div>
                                  <div className="text-3xs text-neutral-400 font-mono">{t.pembeliEmail}</div>
                                </td>
                                <td className="p-5">
                                  <span className={`px-2 py-0.5 rounded-full text-3xs font-extrabold uppercase tracking-wider
                                    ${t.tipeTransaksi === 'Kasir' ? 'bg-neutral-100 text-neutral-800' : 'bg-blue-100 text-blue-900'}
                                  `}>
                                    {t.tipeTransaksi}
                                  </span>
                                </td>
                                <td className="p-5 max-w-[200px] truncate">
                                  {t.itemDibeli.map(item => `${item.product.nama} (${item.quantity}x)`).join(', ')}
                                </td>
                                <td className="p-5 font-bold text-neutral-800">{formatRupiah(t.totalHarga)}</td>
                                <td className="p-5">
                                  <span className={`px-2.5 py-1 rounded-full text-2xs font-bold uppercase tracking-wider
                                    ${t.statusPembayaran === 'Pembayaran Sukses' ? 'bg-green-100 text-green-900' : 'bg-amber-100 text-amber-900'}
                                  `}>
                                    {t.statusPembayaran}
                                  </span>
                                </td>
                                <td className="p-5 text-right whitespace-nowrap">
                                  <button
                                    onClick={() => setSelectedTransaction(t)}
                                    className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-2xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    <span>Buka Nota</span>
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </main>
      </div>

      {/* ========================================================== */}
      {/* DRAWER MODAL: SHOPPING CART (BUYER ONLY)                    */}
      {/* ========================================================== */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden" id="cart-drawer-modal">
          <div className="absolute inset-0 bg-neutral-900/60 backdrop-blur-xs" onClick={() => setIsCartOpen(false)}></div>
          <div className="absolute inset-y-0 right-0 max-w-full flex">
            <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between">
              
              {/* Cart Header */}
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-6 w-6 text-rose-900" />
                  <h3 className="font-serif font-black text-xl text-neutral-800">Keranjang Belanja</h3>
                </div>
                <button 
                  onClick={() => setIsCartOpen(false)}
                  className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-500"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Cart Items List */}
              <div className="flex-1 p-6 overflow-y-auto space-y-4">
                {cart.length === 0 ? (
                  <div className="py-20 text-center text-neutral-400 space-y-3">
                    <ShoppingBag className="h-16 w-16 mx-auto text-neutral-200" />
                    <p className="font-serif text-lg text-neutral-500">Keranjang Belanja Kosong</p>
                    <p className="text-xs text-neutral-400">Silakan tambahkan pakaian cantik dan kosmetik favorit Anda dari Katalog</p>
                  </div>
                ) : (
                  cart.map((item, idx) => (
                    <div key={idx} className="flex gap-4 bg-neutral-50 p-4 rounded-2xl border border-neutral-100 relative group">
                      <img 
                        src={item.product.urlGambar} 
                        alt={item.product.nama} 
                        className="w-20 h-20 object-cover rounded-xl border border-neutral-200"
                      />
                      <div className="flex-1 min-w-0 space-y-1">
                        <span className="text-[10px] text-rose-900 font-bold uppercase">{item.product.kategori}</span>
                        <h4 className="font-serif font-bold text-sm text-neutral-800 truncate leading-snug">{item.product.nama}</h4>
                        <div className="text-2xs text-neutral-400 flex gap-2">
                          <span>Ukuran: <strong className="text-neutral-700">{item.selectedSize}</strong></span>
                        </div>
                        <div className="text-sm font-extrabold text-rose-950 mt-1">{formatRupiah(item.product.harga * item.quantity)}</div>
                        
                        {/* Adjust Qty and Delete */}
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-lg px-2 py-1">
                            <button 
                              onClick={() => updateCartQty(idx, -1)}
                              className="text-neutral-500 hover:text-neutral-800"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                            <button 
                              onClick={() => updateCartQty(idx, 1)}
                              className="text-neutral-500 hover:text-neutral-800"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>

                          <button 
                            onClick={() => removeCartItem(idx)}
                            className="text-neutral-400 hover:text-red-600 transition-colors"
                            title="Hapus Item"
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Cart Footer Checkout Actions */}
              {cart.length > 0 && (
                <div className="p-6 border-t border-neutral-100 bg-neutral-50 space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-400 font-semibold">Total Item</span>
                      <span className="text-neutral-800 font-bold">{cart.reduce((sum, item) => sum + item.quantity, 0)} pcs</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-bold text-neutral-800 pt-2 border-t border-dashed">
                      <span>Total Tagihan Belanja</span>
                      <span className="text-xl font-serif text-rose-950">
                        {formatRupiah(cart.reduce((sum, item) => sum + (item.product.harga * item.quantity), 0))}
                      </span>
                    </div>
                  </div>

                  <button 
                    onClick={handleBuyerCheckout}
                    className="w-full py-3.5 bg-rose-900 hover:bg-rose-800 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-rose-900/10 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Checkout Hubungkan Ke WhatsApp ✨</span>
                  </button>
                  <p className="text-[10px] text-center text-neutral-400 leading-relaxed">
                    Setelah mengklik tombol Checkout, pesanan Anda akan tersimpan di database dan WhatsApp penjual akan terbuka otomatis untuk proses transfer pembayaran.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL FORM: ADD / EDIT PRODUCT (ADMIN ONLY)                 */}
      {/* ========================================================== */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4" id="manage-product-modal">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-neutral-100 overflow-hidden">
            <div className="bg-gradient-to-r from-rose-900 to-rose-950 text-white p-6 flex justify-between items-center">
              <h3 className="font-serif font-bold text-lg">
                {editingProduct ? 'Ubah Informasi Produk' : 'Tambah Produk Baru'}
              </h3>
              <button 
                onClick={() => setIsProductModalOpen(false)}
                className="text-neutral-300 hover:text-white p-1 hover:bg-white/10 rounded-lg"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-2xs font-bold text-neutral-400 uppercase mb-1">Nama Produk *</label>
                  <input 
                    type="text" 
                    value={productForm.nama}
                    onChange={(e) => setProductForm({...productForm, nama: e.target.value})}
                    placeholder="Contoh: Dress Silk Cantik"
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-900 text-sm text-neutral-800"
                    required
                  />
                </div>

                <div>
                  <label className="block text-2xs font-bold text-neutral-400 uppercase mb-1">Harga (Rupiah) *</label>
                  <input 
                    type="number" 
                    value={productForm.harga}
                    onChange={(e) => setProductForm({...productForm, harga: Number(e.target.value)})}
                    placeholder="Contoh: 150000"
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-900 text-sm text-neutral-800"
                    min={0}
                    required
                  />
                </div>

                <div>
                  <label className="block text-2xs font-bold text-neutral-400 uppercase mb-1">Stok Inventory *</label>
                  <input 
                    type="number" 
                    value={productForm.stok}
                    onChange={(e) => setProductForm({...productForm, stok: Number(e.target.value)})}
                    placeholder="Contoh: 20"
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-900 text-sm text-neutral-800"
                    min={0}
                    required
                  />
                </div>

                <div>
                  <label className="block text-2xs font-bold text-neutral-400 uppercase mb-1">Kategori Produk</label>
                  <select 
                    value={productForm.kategori}
                    onChange={(e) => setProductForm({...productForm, kategori: e.target.value as 'Pakaian' | 'Kecantikan'})}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-900 text-sm text-neutral-800"
                  >
                    <option value="Pakaian">Pakaian</option>
                    <option value="Kecantikan">Kecantikan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-bold text-neutral-400 uppercase mb-1">URL Gambar Produk</label>
                  <input 
                    type="url" 
                    value={productForm.urlGambar}
                    onChange={(e) => setProductForm({...productForm, urlGambar: e.target.value})}
                    placeholder="Sediakan URL gambar Unsplash"
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-900 text-sm text-neutral-800"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-2xs font-bold text-neutral-400 uppercase mb-1">Ukuran / Varian (Pisahkan dengan koma) *</label>
                  <input 
                    type="text" 
                    value={productForm.ukuranText}
                    onChange={(e) => setProductForm({...productForm, ukuranText: e.target.value})}
                    placeholder="Pakaian: S, M, L, XL, Jumbo • Kecantikan: Natural, Ivory"
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-900 text-sm text-neutral-800"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-2xs font-bold text-neutral-400 uppercase mb-1">Keterangan Produk</label>
                  <textarea 
                    value={productForm.keterangan}
                    onChange={(e) => setProductForm({...productForm, keterangan: e.target.value})}
                    placeholder="Berikan deskripsi detail produk agar pembeli tertarik..."
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-900 text-sm text-neutral-800 h-20 resize-none"
                  ></textarea>
                </div>
              </div>

              {formError && (
                <div className="p-3 bg-rose-50 text-rose-950 rounded-xl text-xs font-semibold">
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsProductModalOpen(false)}
                  className="flex-1 py-2.5 border border-neutral-300 rounded-xl text-neutral-600 hover:bg-neutral-50 text-sm font-semibold transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2.5 bg-rose-900 hover:bg-rose-800 text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  Simpan Produk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* INVOICE / NOTA MODAL DETAIL VIEW (FOR ADMIN TO VIEW & PRINT) */}
      {/* ========================================================== */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto" id="invoice-detail-modal">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-neutral-100 overflow-hidden my-8">
            <div className="bg-neutral-900 text-white p-6 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-amber-400" />
                <h3 className="font-serif font-bold text-base">Detail Nota Belanja</h3>
              </div>
              <button 
                onClick={() => setSelectedTransaction(null)}
                className="text-neutral-400 hover:text-white p-1 hover:bg-white/10 rounded-lg"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Receipt structure */}
              <div className="text-center pb-4 border-b">
                <h4 className="font-serif font-black text-xl text-neutral-800">B&F Chic Boutique</h4>
                <p className="text-2xs text-amber-600 font-bold uppercase tracking-wider">Simple but Elegant Women</p>
                <p className="text-3xs text-neutral-400 mt-1">Sertifikasi & Garansi Belanja Terjamin • +62 899-6967-565</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-neutral-400 uppercase font-bold block text-2xs">ID Transaksi</span>
                  <span className="font-mono text-neutral-800 font-bold text-sm">{selectedTransaction.id}</span>
                </div>
                <div className="text-right">
                  <span className="text-neutral-400 uppercase font-bold block text-2xs">Tanggal</span>
                  <span className="text-neutral-800 font-medium">
                    {new Date(selectedTransaction.tanggal).toLocaleString('id-ID')}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-400 uppercase font-bold block text-2xs">Pembeli</span>
                  <span className="text-neutral-800 font-bold">{selectedTransaction.pembeliNama}</span>
                </div>
                <div className="text-right">
                  <span className="text-neutral-400 uppercase font-bold block text-2xs">Tipe Pembelian</span>
                  <span className="text-neutral-800 font-medium">{selectedTransaction.tipeTransaksi}</span>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2.5">
                <span className="text-2xs text-neutral-400 font-extrabold uppercase tracking-widest block">Barang Belanja</span>
                {selectedTransaction.itemDibeli.map((item, index) => (
                  <div key={index} className="flex justify-between items-center text-xs bg-neutral-50 p-2.5 rounded-lg border">
                    <div>
                      <span className="font-bold text-neutral-800 block">{item.product.nama}</span>
                      <span className="text-3xs text-neutral-400">Ukuran/Varian: {item.selectedSize || 'All Size'}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-neutral-800 block">{formatRupiah(item.product.harga * item.quantity)}</span>
                      <span className="text-3xs text-neutral-400">{item.quantity} x {formatRupiah(item.product.harga)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total and Payment Status */}
              <div className="bg-rose-50 p-4 rounded-xl flex justify-between items-center border border-rose-100">
                <div>
                  <span className="text-xs text-rose-900 font-semibold block">Total Bayar</span>
                  <span className="text-[10px] text-rose-700 block bg-rose-100 px-2.5 py-0.5 rounded-full mt-1.5 uppercase tracking-wide inline-block font-bold">
                    {selectedTransaction.statusPembayaran}
                  </span>
                </div>
                <span className="text-xl font-serif font-black text-rose-950">
                  {formatRupiah(selectedTransaction.totalHarga)}
                </span>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => window.print()}
                  className="flex-1 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
                >
                  <Printer className="h-4 w-4" />
                  <span>Cetak Nota</span>
                </button>
                <button 
                  onClick={() => setSelectedTransaction(null)}
                  className="flex-1 py-2.5 border border-neutral-300 hover:bg-neutral-50 text-neutral-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="bg-neutral-900 border-t border-neutral-800 text-neutral-500 py-6 text-center text-xs space-y-1">
        <p>© 2026 B&F Chic Boutique. Semua Hak Dilindungi Undang-Undang.</p>
        <p className="font-light text-neutral-600">Terhubung secara real-time dengan Database & WhatsApp Penjual +62 899-6967-565</p>
      </footer>

    </div>
  );
}
