/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  id: string;
  nama: string;
  harga: number;
  stok: number;
  kategori: 'Pakaian' | 'Kecantikan';
  urlGambar: string;
  keterangan: string;
  ukuran: string[];
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedSize?: string;
}

export interface Transaction {
  id: string;
  tanggal: string; // ISO string
  totalHarga: number;
  itemDibeli: CartItem[];
  pembeliNama: string;
  pembeliEmail: string;
  statusPembayaran: 'Pending' | 'Pembayaran Sukses';
  tipeTransaksi: 'Kasir' | 'Online';
}

const DB_NAME = 'bndf_chic_boutique_db';
const DB_VERSION = 1;

// 1. Initialize Native IndexedDB
export function initIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Error opening IndexedDB');
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      
      // Store products
      if (!db.objectStoreNames.contains('products')) {
        db.createObjectStore('products', { keyPath: 'id' });
      }

      // Store transactions
      if (!db.objectStoreNames.contains('transactions')) {
        db.createObjectStore('transactions', { keyPath: 'id' });
      }
    };
  });
}

// ==========================================
// PRODUCTS STORE CRUD OPERATIONS (LOCAL)
// ==========================================

export async function addLocalProduct(product: Product): Promise<void> {
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('products', 'readwrite');
    const store = transaction.objectStore('products');
    const request = store.put(product);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getLocalProducts(): Promise<Product[]> {
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('products', 'readonly');
    const store = transaction.objectStore('products');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function updateLocalProduct(product: Product): Promise<void> {
  return addLocalProduct(product); // put handles both add and update in IndexedDB
}

export async function deleteLocalProduct(id: string): Promise<void> {
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('products', 'readwrite');
    const store = transaction.objectStore('products');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ==========================================
// TRANSACTIONS STORE CRUD OPERATIONS (LOCAL)
// ==========================================

export async function addLocalTransaction(trans: Transaction): Promise<void> {
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('transactions', 'readwrite');
    const store = transaction.objectStore('transactions');
    const request = store.put(trans);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getLocalTransactions(): Promise<Transaction[]> {
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('transactions', 'readonly');
    const store = transaction.objectStore('transactions');
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort newest first
      const results = request.result as Transaction[];
      results.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function updateLocalTransaction(trans: Transaction): Promise<void> {
  return addLocalTransaction(trans);
}

export async function deleteLocalTransaction(id: string): Promise<void> {
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('transactions', 'readwrite');
    const store = transaction.objectStore('transactions');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}


// ==========================================================
// SYNC ENGINE - CONNECT LOCAL INDEXEDDB TO SERVER DATABASE
// ==========================================================

// Pull all products from server and update local IndexedDB
export async function syncProductsFromServer(): Promise<Product[]> {
  try {
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error('Gagal mengambil produk dari server');
    const products: Product[] = await response.json();

    // Clear local IndexedDB products store and refill with latest
    const db = await initIndexedDB();
    const transaction = db.transaction('products', 'readwrite');
    const store = transaction.objectStore('products');
    
    // Clear
    store.clear();
    
    // Put all
    for (const prod of products) {
      store.put(prod);
    }

    return products;
  } catch (error) {
    console.warn('Sync server products failed, falling back to local storage:', error);
    return getLocalProducts();
  }
}

// Pull all transactions from server and update local IndexedDB
export async function syncTransactionsFromServer(): Promise<Transaction[]> {
  try {
    const response = await fetch('/api/transactions');
    if (!response.ok) throw new Error('Gagal mengambil transaksi dari server');
    const transactions: Transaction[] = await response.json();

    // Clear local IndexedDB transactions store and refill with latest
    const db = await initIndexedDB();
    const transaction = db.transaction('transactions', 'readwrite');
    const store = transaction.objectStore('transactions');
    
    // Clear
    store.clear();
    
    // Put all
    for (const trans of transactions) {
      store.put(trans);
    }

    return transactions;
  } catch (error) {
    console.warn('Sync server transactions failed, falling back to local storage:', error);
    return getLocalTransactions();
  }
}

// 1. ADD / CREATE PRODUCT (CLIENT & SERVER)
export async function createProduct(productData: Omit<Product, 'id'>): Promise<Product> {
  const response = await fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(productData)
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Gagal menambahkan produk ke server');
  }

  const newProd: Product = await response.json();
  await addLocalProduct(newProd); // Sync to local
  return newProd;
}

// 2. UPDATE PRODUCT (CLIENT & SERVER)
export async function editProduct(id: string, productData: Partial<Product>): Promise<Product> {
  const response = await fetch(`/api/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(productData)
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Gagal mengubah produk di server');
  }

  const updatedProd: Product = await response.json();
  await updateLocalProduct(updatedProd); // Sync to local
  return updatedProd;
}

// 3. DELETE PRODUCT (CLIENT & SERVER)
export async function removeProduct(id: string): Promise<void> {
  const response = await fetch(`/api/products/${id}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Gagal menghapus produk di server');
  }

  await deleteLocalProduct(id); // Sync to local
}

// 4. CHECKOUT (CLIENT & SERVER)
export async function checkoutTransaction(
  itemDibeli: CartItem[], 
  pembeliNama: string, 
  pembeliEmail: string,
  tipeTransaksi: 'Kasir' | 'Online'
): Promise<Transaction> {
  const response = await fetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemDibeli, pembeliNama, pembeliEmail, tipeTransaksi })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Gagal checkout transaksi');
  }

  const newTrans: Transaction = await response.json();
  await addLocalTransaction(newTrans); // Sync to local
  return newTrans;
}

// 5. CONFIRM PAYMENT (FOR ONLINE INVOICE)
export async function confirmOnlinePayment(transactionId: string): Promise<Transaction> {
  const response = await fetch(`/api/transactions/${transactionId}/confirm-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Gagal konfirmasi pembayaran');
  }

  const result = await response.json();
  const updatedTrans: Transaction = result.transaction;
  await updateLocalTransaction(updatedTrans); // Sync to local
  
  // Trigger a pull to ensure local product stocks are also updated
  await syncProductsFromServer();

  return updatedTrans;
}
