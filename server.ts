import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.resolve(__dirname, 'db.json');

// Supabase Configuration
const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseKey = (process.env.SUPABASE_ANON_KEY || '').trim();
let isSupabaseConfigured = false;
let supabase: any = null;

if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('http')) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    isSupabaseConfigured = true;
    console.log('Supabase is configured! Connected to:', supabaseUrl);
  } catch (error: any) {
    console.error('Failed to initialize Supabase client:', error?.message || error);
  }
} else {
  console.log('Supabase is not configured yet or has invalid URL. Falling back to local db.json.');
}

// Interface declarations
interface Product {
  id: string;
  nama: string;
  harga: number;
  stok: number;
  kategori: 'Pakaian' | 'Kecantikan';
  urlGambar: string;
  keterangan: string;
  ukuran: string[]; // for clothing e.g. ["S", "M", "L", "XL", "Bigsize"]
}

interface CartItem {
  product: Product;
  quantity: number;
  selectedSize?: string;
}

interface Transaction {
  id: string;
  tanggal: string; // ISO string
  totalHarga: number;
  itemDibeli: CartItem[];
  pembeliNama: string;
  pembeliEmail: string;
  statusPembayaran: 'Pending' | 'Pembayaran Sukses';
  tipeTransaksi: 'Kasir' | 'Online';
}

interface Buyer {
  email: string;
  nama: string;
  tanggalDaftar: string;
}

interface DatabaseSchema {
  products: Product[];
  transactions: Transaction[];
  buyers: Buyer[];
}

// Default initial products
const DEFAULT_PRODUCTS: Product[] = [
  {
    id: "prod-1",
    nama: "Chic Silk Wrap Dress",
    harga: 389000,
    stok: 15,
    kategori: "Pakaian",
    urlGambar: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=600",
    keterangan: "Dress satin silk premium dengan siluet wrap anggun. Memberikan kesan ramping, elegan, dan nyaman dipakai dari ukuran S hingga XXL.",
    ukuran: ["S", "M", "L", "XL", "XXL (Big Size)"]
  },
  {
    id: "prod-2",
    nama: "Elegant Linen Blazer",
    harga: 329000,
    stok: 12,
    kategori: "Pakaian",
    urlGambar: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&q=80&w=600",
    keterangan: "Blazer berbahan linen rami premium dengan cutting formal tapi santai. Sangat pas dipakai untuk mempercantik look semi-formal Anda.",
    ukuran: ["M", "L", "XL", "Jumbo"]
  },
  {
    id: "prod-3",
    nama: "Graceful Pleated Midi Skirt",
    harga: 249000,
    stok: 20,
    kategori: "Pakaian",
    urlGambar: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=600",
    keterangan: "Rok plisket premium dengan lipatan kokoh dan tidak menerawang. Pinggang full karet elastis yang sangat bersahabat untuk semua jenis ukuran badan.",
    ukuran: ["All Size (S-XL)", "Jumbo (Big Size)"]
  },
  {
    id: "prod-4",
    nama: "Aurora Floral Blouse",
    harga: 189000,
    stok: 18,
    kategori: "Pakaian",
    urlGambar: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=600",
    keterangan: "Blouse manis motif floral berbahan sifon import berfuring. Adem, jatuh cantik di badan, dengan aksen ruffle di lengan.",
    ukuran: ["S", "M", "L", "XL", "Big Size Up to 95kg"]
  },
  {
    id: "prod-5",
    nama: "Classy High-Waist Culottes",
    harga: 219000,
    stok: 25,
    kategori: "Pakaian",
    urlGambar: "https://images.unsplash.com/photo-1509551388413-e18d0ac5d495?auto=format&fit=crop&q=80&w=600",
    keterangan: "Celana kulot dengan potongan pinggang tinggi memberikan efek kaki lebih jenjang. Bahan anti kusut dan flowy saat melangkah.",
    ukuran: ["S/M", "L/XL", "Jumbo (XXL-XXXL)"]
  },
  {
    id: "prod-6",
    nama: "Glow Radiance Rose Serum",
    harga: 159000,
    stok: 30,
    kategori: "Kecantikan",
    urlGambar: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&q=80&w=600",
    keterangan: "Serum wajah pencerah dengan konsentrat bunga mawar murni, Vitamin C, dan Hyaluronic Acid. Memudarkan flek hitam dan memberikan glass-skin glow.",
    ukuran: ["30ml Standard"]
  },
  {
    id: "prod-7",
    nama: "Velvet Matte Cushion SPF 35",
    harga: 179000,
    stok: 22,
    kategori: "Kecantikan",
    urlGambar: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&q=80&w=600",
    keterangan: "Cushion ringan dengan daya tutup tinggi, hasil akhir semi-matte yang menyerap minyak berlebih tapi tetap menjaga kulit terhidrasi alami.",
    ukuran: ["Natural Beige", "Ivory Glow", "Warm Sand"]
  },
  {
    id: "prod-8",
    nama: "Hydrating Peach Lip Oil",
    harga: 89000,
    stok: 40,
    kategori: "Kecantikan",
    urlGambar: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&q=80&w=600",
    keterangan: "Nutrisi ekstra untuk bibir kering. Mengandung jojoba oil dan ekstrak buah peach, memberikan warna peach merona alami dengan kilau sehat.",
    ukuran: ["5ml Bottle"]
  },
  {
    id: "prod-9",
    nama: "Chic Cushion Blush On",
    harga: 119000,
    stok: 15,
    kategori: "Kecantikan",
    urlGambar: "https://images.unsplash.com/photo-1631730359575-38e4755d772b?auto=format&fit=crop&q=80&w=600",
    keterangan: "Perona pipi cair bertekstur cushion yang sangat mudah diratakan dengan jari atau sponge. Rona manis merah muda yang menyatu di kulit.",
    ukuran: ["Rosy Pink", "Sweet Peach"]
  },
  {
    id: "prod-10",
    nama: "Silky Clay Mask Green Tea",
    harga: 99000,
    stok: 28,
    kategori: "Kecantikan",
    urlGambar: "https://images.unsplash.com/photo-1567894340315-735d7c361db0?auto=format&fit=crop&q=80&w=600",
    keterangan: "Masker tanah liat lembut dengan khasiat daun teh hijau Jepang untuk mendetoksifikasi sisa kosmetik, membersihkan pori, dan meredakan jerawat.",
    ukuran: ["100g Jar"]
  }
];

// Helper functions for file DB
function readDB(): DatabaseSchema {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initialData: DatabaseSchema = {
        products: DEFAULT_PRODUCTS,
        transactions: [],
        buyers: []
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
      return initialData;
    }
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(data) as any;
    
    // Safety guarantees for each field
    return {
      products: Array.isArray(parsed?.products) ? parsed.products : DEFAULT_PRODUCTS,
      transactions: Array.isArray(parsed?.transactions) ? parsed.transactions : [],
      buyers: Array.isArray(parsed?.buyers) ? parsed.buyers : []
    };
  } catch (error) {
    console.error('Error reading file database:', error);
    return { products: DEFAULT_PRODUCTS, transactions: [], buyers: [] };
  }
}

function writeDB(data: DatabaseSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing file database:', error);
  }
}

// Supabase DB auto-initializer
async function initSupabaseDatabase() {
  if (!supabase) return;
  console.log('Checking Supabase tables and seeding defaults if empty...');
  try {
    // 1. Check & Seed Products
    const { data: existingProds, error: prodError } = await supabase
      .from('products')
      .select('id')
      .limit(1);

    if (prodError) {
      console.warn('Could not query "products" table in Supabase. You can create it with the SQL schema listed in the app guides.', prodError.message);
      return;
    }

    if (!existingProds || existingProds.length === 0) {
      console.log('Seeding products table in Supabase...');
      const { error: seedError } = await supabase.from('products').insert(DEFAULT_PRODUCTS);
      if (seedError) {
        console.error('Failed to seed default products in Supabase:', seedError.message);
      } else {
        console.log('Products table successfully seeded in Supabase!');
      }
    }
  } catch (error) {
    console.error('Exception during Supabase initialization check:', error);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Log requests for debugging
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });

  // Call Supabase DB auto-seeder
  if (supabase) {
    await initSupabaseDatabase();
  }

  // API - SUPABASE CONFIGURATION STATUS
  app.get('/api/supabase-status', (_req, res) => {
    res.json({
      configured: isSupabaseConfigured,
      url: supabaseUrl ? `${supabaseUrl.substring(0, 15)}...` : null
    });
  });

  // API - LOGIN ENDPOINT
  app.post('/api/login', async (req, res) => {
    try {
      const { email, password, nama } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email wajib diisi' });
      }

      const emailStr = String(email || '');
      const emailClean = emailStr.trim().toLowerCase();

      // Admin login
      if (emailClean === 'meythadaning05@gmail.com') {
        if (password === 'meyta1234' || password === 'meyta123') {
          return res.json({
            email: 'meythadaning05@gmail.com',
            nama: 'Meytha Daning (Admin)',
            role: 'admin'
          });
        } else {
          return res.status(401).json({ error: 'Password Admin salah' });
        }
      }

      // Buyer login/registration
      let loggedInBuyer: Buyer | null = null;

      if (supabase) {
        try {
          const { data: bData, error: bError } = await supabase
            .from('buyers')
            .select('*')
            .eq('email', emailClean)
            .maybeSingle();

          if (bError) throw bError;

          if (!bData) {
            // Register new buyer in Supabase
            const newBuyer: Buyer = {
              email: emailClean,
              nama: nama ? String(nama).trim() : 'Pelanggan Cantik',
              tanggalDaftar: new Date().toISOString()
            };
            const { error: insError } = await supabase.from('buyers').insert(newBuyer);
            if (insError) throw insError;
            loggedInBuyer = newBuyer;
          } else {
            loggedInBuyer = bData;
            if (nama && bData.nama !== String(nama).trim()) {
              // Update name in Supabase
              const { error: updError } = await supabase
                .from('buyers')
                .update({ nama: String(nama).trim() })
                .eq('email', emailClean);
              if (!updError) {
                loggedInBuyer.nama = String(nama).trim();
              }
            }
          }
        } catch (err: any) {
          console.error('Supabase login failed, trying file DB fallback:', err?.message || err);
        }
      }

      // Fallback if Supabase is inactive or failed
      if (!loggedInBuyer) {
        const db = readDB();
        let buyer = db.buyers.find(b => b && b.email && String(b.email).toLowerCase() === emailClean);

        if (!buyer) {
          const newBuyer: Buyer = {
            email: emailClean,
            nama: nama ? String(nama).trim() : 'Pelanggan Cantik',
            tanggalDaftar: new Date().toISOString()
          };
          db.buyers.push(newBuyer);
          writeDB(db);
          buyer = newBuyer;
        } else if (nama) {
          buyer.nama = String(nama).trim();
          writeDB(db);
        }
        loggedInBuyer = buyer;
      }

      return res.json({
        email: loggedInBuyer.email,
        nama: loggedInBuyer.nama,
        role: 'buyer'
      });
    } catch (error: any) {
      console.error('Login error:', error);
      return res.status(500).json({ error: error?.message || 'Terjadi kesalahan sistem saat login.' });
    }
  });

  // API - BUYERS ENDPOINT
  app.get('/api/buyers', async (_req, res) => {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('buyers').select('*');
        if (!error && data) {
          return res.json(data);
        }
      } catch (err) {
        console.error('Supabase get buyers failed:', err);
      }
    }

    const db = readDB();
    res.json(db.buyers);
  });

  // API - PRODUCTS ENDPOINTS
  app.get('/api/products', async (_req, res) => {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('products').select('*').order('id', { ascending: true });
        if (!error && data) {
          return res.json(data);
        } else {
          console.warn('Supabase product query returned error, falling back to local file:', error?.message);
        }
      } catch (err) {
        console.error('Supabase products failed, fallback to local:', err);
      }
    }

    const db = readDB();
    res.json(db.products);
  });

  app.post('/api/products', async (req, res) => {
    const { nama, harga, stok, kategori, urlGambar, keterangan, ukuran } = req.body;

    if (!nama || !harga || stok === undefined || !kategori) {
      return res.status(400).json({ error: 'Nama, harga, stok, dan kategori wajib diisi.' });
    }

    const newProduct: Product = {
      id: `prod-${Date.now()}`,
      nama: nama.trim(),
      harga: Number(harga),
      stok: Number(stok),
      kategori: kategori,
      urlGambar: urlGambar?.trim() || "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=600",
      keterangan: keterangan?.trim() || "Pilihan elegan dan simple untuk melengkapi hari-hari Anda.",
      ukuran: Array.isArray(ukuran) && ukuran.length > 0 ? ukuran : ["All Size"]
    };

    if (supabase) {
      try {
        const { error } = await supabase.from('products').insert(newProduct);
        if (!error) {
          return res.status(201).json(newProduct);
        }
        console.error('Supabase product insert error:', error.message);
      } catch (err) {
        console.error('Supabase product insert failed:', err);
      }
    }

    const db = readDB();
    db.products.push(newProduct);
    writeDB(db);

    res.status(201).json(newProduct);
  });

  app.put('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    const { nama, harga, stok, kategori, urlGambar, keterangan, ukuran } = req.body;

    if (supabase) {
      try {
        // Fetch current product to merge updates
        const { data: currentProduct, error: fetchErr } = await supabase
          .from('products')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (!fetchErr && currentProduct) {
          const updatedProduct = {
            nama: nama !== undefined ? nama.trim() : currentProduct.nama,
            harga: harga !== undefined ? Number(harga) : currentProduct.harga,
            stok: stok !== undefined ? Number(stok) : currentProduct.stok,
            kategori: kategori !== undefined ? kategori : currentProduct.kategori,
            urlGambar: urlGambar !== undefined ? urlGambar.trim() : currentProduct.urlGambar,
            keterangan: keterangan !== undefined ? keterangan.trim() : currentProduct.keterangan,
            ukuran: Array.isArray(ukuran) ? ukuran : currentProduct.ukuran
          };

          const { error: updateErr } = await supabase
            .from('products')
            .update(updatedProduct)
            .eq('id', id);

          if (!updateErr) {
            return res.json({ id, ...updatedProduct });
          }
          console.error('Supabase edit product error:', updateErr.message);
        }
      } catch (err) {
        console.error('Supabase edit product exception:', err);
      }
    }

    const db = readDB();
    const index = db.products.findIndex(p => p.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Produk tidak ditemukan.' });
    }

    db.products[index] = {
      ...db.products[index],
      nama: nama !== undefined ? nama.trim() : db.products[index].nama,
      harga: harga !== undefined ? Number(harga) : db.products[index].harga,
      stok: stok !== undefined ? Number(stok) : db.products[index].stok,
      kategori: kategori !== undefined ? kategori : db.products[index].kategori,
      urlGambar: urlGambar !== undefined ? urlGambar.trim() : db.products[index].urlGambar,
      keterangan: keterangan !== undefined ? keterangan.trim() : db.products[index].keterangan,
      ukuran: Array.isArray(ukuran) ? ukuran : db.products[index].ukuran
    };

    writeDB(db);
    res.json(db.products[index]);
  });

  app.delete('/api/products/:id', async (req, res) => {
    const { id } = req.params;

    if (supabase) {
      try {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (!error) {
          return res.json({ message: 'Produk berhasil dihapus.' });
        }
        console.error('Supabase delete product error:', error.message);
      } catch (err) {
        console.error('Supabase delete product failed:', err);
      }
    }

    const db = readDB();
    const index = db.products.findIndex(p => p.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Produk tidak ditemukan.' });
    }

    db.products.splice(index, 1);
    writeDB(db);
    res.json({ message: 'Produk berhasil dihapus.' });
  });

  // API - TRANSACTIONS ENDPOINTS
  app.get('/api/transactions', async (_req, res) => {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('transactions').select('*');
        if (!error && data) {
          // Parse itemDibeli if it comes back as string (some Supabase types require parsing)
          const parsedData = data.map((trans: any) => ({
            ...trans,
            itemDibeli: typeof trans.itemDibeli === 'string' ? JSON.parse(trans.itemDibeli) : trans.itemDibeli
          }));
          return res.json(parsedData);
        }
      } catch (err) {
        console.error('Supabase transactions query error:', err);
      }
    }

    const db = readDB();
    res.json(db.transactions);
  });

  // Fetch a specific transaction
  app.get('/api/transactions/:id', async (req, res) => {
    const { id } = req.params;

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (!error && data) {
          const trans = {
            ...data,
            itemDibeli: typeof data.itemDibeli === 'string' ? JSON.parse(data.itemDibeli) : data.itemDibeli
          };
          return res.json(trans);
        }
      } catch (err) {
        console.error('Supabase transactions single fetch error:', err);
      }
    }

    const db = readDB();
    const trans = db.transactions.find(t => t.id === id);
    if (!trans) {
      return res.status(404).json({ error: 'Nota transaksi tidak ditemukan' });
    }
    res.json(trans);
  });

  // Checkout (Create transaction)
  app.post('/api/transactions', async (req, res) => {
    const { itemDibeli, pembeliNama, pembeliEmail, tipeTransaksi } = req.body;

    if (!itemDibeli || !Array.isArray(itemDibeli) || itemDibeli.length === 0) {
      return res.status(400).json({ error: 'Item belanja tidak boleh kosong.' });
    }

    // Calculate total price
    let totalHarga = 0;
    for (const item of itemDibeli) {
      totalHarga += item.product.harga * item.quantity;
    }

    const transId = `nota-${Date.now()}`;
    const newTransaction: Transaction = {
      id: transId,
      tanggal: new Date().toISOString(),
      totalHarga,
      itemDibeli,
      pembeliNama: pembeliNama?.trim() || 'Pembeli Walk-in',
      pembeliEmail: pembeliEmail?.trim().toLowerCase() || 'walkin@boutique.com',
      statusPembayaran: tipeTransaksi === 'Kasir' ? 'Pembayaran Sukses' : 'Pending',
      tipeTransaksi: tipeTransaksi || 'Online'
    };

    if (supabase) {
      try {
        // If it's Kasir (walk-in checkout), deduct stock immediately in Supabase
        if (tipeTransaksi === 'Kasir') {
          for (const item of itemDibeli) {
            const { data: prod, error: fErr } = await supabase
              .from('products')
              .select('stok')
              .eq('id', item.product.id)
              .maybeSingle();

            if (!fErr && prod) {
              const nextStok = Math.max(0, prod.stok - item.quantity);
              await supabase.from('products').update({ stok: nextStok }).eq('id', item.product.id);
            }
          }
        }

        const { error } = await supabase.from('transactions').insert(newTransaction);
        if (!error) {
          return res.status(201).json(newTransaction);
        }
        console.error('Supabase transaction insert failed:', error.message);
      } catch (err) {
        console.error('Supabase transaction exception:', err);
      }
    }

    // Fallback file DB write
    const db = readDB();
    if (tipeTransaksi === 'Kasir') {
      for (const item of itemDibeli) {
        const prodIndex = db.products.findIndex(p => p.id === item.product.id);
        if (prodIndex !== -1) {
          db.products[prodIndex].stok = Math.max(0, db.products[prodIndex].stok - item.quantity);
        }
      }
    }

    db.transactions.push(newTransaction);
    writeDB(db);

    res.status(201).json(newTransaction);
  });

  // Confirm payment & deduct stock automatically
  app.post('/api/transactions/:id/confirm-payment', async (req, res) => {
    const { id } = req.params;

    if (supabase) {
      try {
        const { data: trans, error: fErr } = await supabase
          .from('transactions')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (!fErr && trans) {
          const transObj = {
            ...trans,
            itemDibeli: typeof trans.itemDibeli === 'string' ? JSON.parse(trans.itemDibeli) : trans.itemDibeli
          };

          if (transObj.statusPembayaran === 'Pending') {
            // Update status to success
            const { error: updErr } = await supabase
              .from('transactions')
              .update({ statusPembayaran: 'Pembayaran Sukses' })
              .eq('id', id);

            if (!updErr) {
              transObj.statusPembayaran = 'Pembayaran Sukses';

              // Reduce stocks in Supabase
              for (const item of transObj.itemDibeli) {
                const { data: pData } = await supabase
                  .from('products')
                  .select('stok')
                  .eq('id', item.product.id)
                  .maybeSingle();

                if (pData) {
                  const nextStok = Math.max(0, pData.stok - item.quantity);
                  await supabase.from('products').update({ stok: nextStok }).eq('id', item.product.id);
                }
              }

              return res.json({ message: 'Pembayaran berhasil dikonfirmasi. Stok otomatis berkurang.', transaction: transObj });
            }
          } else {
            return res.json({ message: 'Transaksi ini sudah berstatus pembayaran sukses sebelumnya.', transaction: transObj });
          }
        }
      } catch (err) {
        console.error('Supabase confirm-payment failed, trying fallback:', err);
      }
    }

    // Fallback confirm payment
    const db = readDB();
    const transIndex = db.transactions.findIndex(t => t.id === id);

    if (transIndex === -1) {
      return res.status(404).json({ error: 'Nota transaksi tidak ditemukan.' });
    }

    const transaction = db.transactions[transIndex];

    if (transaction.statusPembayaran === 'Pending') {
      transaction.statusPembayaran = 'Pembayaran Sukses';

      for (const item of transaction.itemDibeli) {
        const prodIndex = db.products.findIndex(p => p.id === item.product.id);
        if (prodIndex !== -1) {
          db.products[prodIndex].stok = Math.max(0, db.products[prodIndex].stok - item.quantity);
        }
      }

      writeDB(db);
      res.json({ message: 'Pembayaran berhasil dikonfirmasi. Stok otomatis berkurang.', transaction });
    } else {
      res.json({ message: 'Transaksi ini sudah berstatus pembayaran sukses sebelumnya.', transaction });
    }
  });

  // VITE INTEGRATION OR STATIC FILE SERVING
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    console.log('Running server in development (Vite Middleware) mode');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    console.log('Running server in production (Static Assets) mode');
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const port = 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start full-stack server:', err);
});
