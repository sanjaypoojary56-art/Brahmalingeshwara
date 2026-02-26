

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'lamp-shop-dev-secret',
    resave: false,
    saveUninitialized: false
  })
);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: 'Login required' });
  }

  return next();
}

function requireSeller(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'seller') {
    return res.status(403).json({ success: false, message: 'Seller access required' });
  }

  return next();
}

app.get('/api/health', (_req, res) => {
  res.json({ success: true });
});

app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, phone, role } = req.body;

    if (!username || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const allowedRoles = ['buyer', 'seller'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users(username, email, password_hash, phone, role)
       VALUES($1, $2, $3, $4, $5)
       RETURNING id, username, email, role`,
      [username, email, hash, phone || null, role]
    );

    return res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'Email already exists' });
    }

    return res.status(500).json({ success: false, message: 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!result.rows.length) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const matched = await bcrypt.compare(password, user.password_hash);

    if (!matched) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    return res.json({ success: true, role: user.role, user: req.session.user });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Login failed' });
  }
});

app.post('/api/logout', requireLogin, (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

app.get('/api/me', (req, res) => {
  res.json({ success: true, user: req.session.user || null });
});

app.get('/api/categories', async (_req, res) => {
  try {
    const result = await pool.query('SELECT id, name FROM categories ORDER BY name');
    res.json({ success: true, categories: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not load categories' });
  }
});

app.post('/api/products', requireSeller, upload.single('image'), async (req, res) => {
  try {
    const { name, price, stock, category_id } = req.body;

    if (!name || !price || !category_id) {
      return res.status(400).json({ success: false, message: 'Missing required product fields' });
    }

    let imageUrl = null;

    if (
      req.file &&
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    ) {
      const uploaded = await cloudinary.uploader.upload(req.file.path);
      imageUrl = uploaded.secure_url;
    } else if (req.body.image_url) {
      imageUrl = req.body.image_url;
    }

    const result = await pool.query(
      `INSERT INTO products(seller_id, category_id, name, price, stock, image_url)
       VALUES($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.session.user.id, category_id, name, Number(price), Number(stock) || 0, imageUrl]
    );

    return res.json({ success: true, product: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Could not add product' });
  }
});

app.get('/api/products', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, c.name AS category_name, u.username AS seller_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN users u ON u.id = p.seller_id
       ORDER BY p.created_at DESC`
    );

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json([]);
  }
});

app.post('/api/cart', requireLogin, async (req, res) => {
  try {
    if (req.session.user.role !== 'buyer') {
      return res.status(403).json({ success: false, message: 'Only buyers can use cart' });
    }

    const { product_id, quantity } = req.body;
    const qty = Number(quantity) || 1;

    const productResult = await pool.query('SELECT id FROM products WHERE id = $1', [product_id]);
    if (!productResult.rows.length) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    await pool.query('INSERT INTO cart(buyer_id, product_id, quantity) VALUES($1, $2, $3)', [
      req.session.user.id,
      product_id,
      qty
    ]);

    return res.json({ success: true, message: 'Added to cart' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Could not add to cart' });
  }
});

app.post('/api/orders', requireLogin, async (req, res) => {
  const client = await pool.connect();

  try {
    if (req.session.user.role !== 'buyer') {
      return res.status(403).json({ success: false, message: 'Only buyers can place orders' });
    }

    const { product_id, quantity, address, payment_method } = req.body;
    const qty = Number(quantity) || 1;

    if (!address) {
      return res.status(400).json({ success: false, message: 'Address is required' });
    }

    if (payment_method !== 'Cash on Delivery') {
      return res.status(400).json({ success: false, message: 'Only Cash on Delivery is available' });
    }

    await client.query('BEGIN');

    const productRes = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [product_id]);

    if (!productRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const product = productRes.rows[0];

    if ((product.stock || 0) < qty) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Insufficient stock' });
    }

    const totalPrice = Number(product.price) * qty;

    const orderRes = await client.query(
      `INSERT INTO orders(buyer_id, product_id, quantity, total_price, address, payment_method, status)
       VALUES($1, $2, $3, $4, $5, $6, 'Processing')
       RETURNING *`,
      [req.session.user.id, product_id, qty, totalPrice, address, payment_method]
    );

    await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [qty, product_id]);
    await client.query('COMMIT');

    return res.json({ success: true, order: orderRes.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, message: 'Order could not be placed' });
  } finally {
    client.release();
  }
});

app.get('/api/seller/orders', requireSeller, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.id, o.quantity, o.total_price, o.address, o.payment_method, o.status, o.created_at,
              p.name AS product_name, b.username AS buyer_name
       FROM orders o
       JOIN products p ON p.id = o.product_id
       JOIN users b ON b.id = o.buyer_id
       WHERE p.seller_id = $1
       ORDER BY o.created_at DESC`,
      [req.session.user.id]
    );

    return res.json({ success: true, orders: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Could not load orders' });
  }
});

app.patch('/api/seller/orders/:id/status', requireSeller, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowedStatuses = ['Processing', 'Packed', 'Shipped', 'Delivered', 'Cancelled'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const result = await pool.query(
      `UPDATE orders o
       SET status = $1
       FROM products p
       WHERE o.id = $2
         AND p.id = o.product_id
         AND p.seller_id = $3
       RETURNING o.*`,
      [status, id, req.session.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    return res.json({ success: true, order: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Could not update order status' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
