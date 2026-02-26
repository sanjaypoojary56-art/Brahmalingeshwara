

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const uploadsDir = path.join(__dirname, 'uploads');
const upload = multer({ dest: uploadsDir });
const maxProductImages = 6;

function normalizeStoredImageList(product) {
  if (Array.isArray(product?.image_urls) && product.image_urls.length) {
    return product.image_urls;
  }

  const rawValue = product?.image_url;
  if (!rawValue) {
    return [];
  }

  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return [];
    }

    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.filter(Boolean);
        }
      } catch (_error) {
        // no-op
      }
    }

    return [trimmed];
  }

  return [];
}

function isHeicImage(file) {
  if (!file) {
    return false;
  }

  const normalizedMimeType = (file.mimetype || '').toLowerCase();
  const normalizedFileName = (file.originalname || '').toLowerCase();

  return (
    normalizedMimeType.includes('heic') ||
    normalizedMimeType.includes('heif') ||
    normalizedFileName.endsWith('.heic') ||
    normalizedFileName.endsWith('.heif')
  );
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static(uploadsDir));

fs.mkdir(uploadsDir, { recursive: true }).catch(() => {});
app.use('/uploads', express.static('uploads'));

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

  if (!req.session.user.seller_approved) {
    return res.status(403).json({ success: false, message: 'Seller account is pending authorizer approval' });
  }

  return next();
}

function requireAuthorizer(req, res, next) {
  if (!req.session.user || !req.session.user.is_authorizer) {
    return res.status(403).json({ success: false, message: 'Authorizer access required' });
  }

  return next();
}

app.get('/api/health', (_req, res) => {
  res.json({ success: true });
});

async function ensureSellerRegistrationApprovalsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS seller_registration_approvals (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by INTEGER REFERENCES users(id),
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

ensureSellerRegistrationApprovalsTable().catch((error) => {
  console.error('Could not initialize seller approval table:', error.message);
});

app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, phone, role } = req.body;
    const normalizedUsername = username ? username.trim() : '';
    const normalizedEmail = email ? email.trim().toLowerCase() : '';

    if (!normalizedUsername || !normalizedEmail || !password || !role) {
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
      [normalizedUsername, normalizedEmail, hash, phone || null, role]
    );

    if (role === 'seller') {
      await pool.query(
        `INSERT INTO seller_registration_approvals(user_id, status)
         VALUES($1, 'pending')
         ON CONFLICT (user_id)
         DO UPDATE SET status = 'pending', reviewed_by = NULL, reviewed_at = NULL, updated_at = NOW()`,
        [result.rows[0].id]
      );
    }

    return res.json({
      success: true,
      user: result.rows[0],
      message: role === 'seller' ? 'Registration submitted. Wait for authorizer approval.' : null
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'Email already exists' });
    }

    return res.status(500).json({ success: false, message: error.message || 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email ? email.trim().toLowerCase() : '';

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    if (!result.rows.length) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const matched = await bcrypt.compare(password, user.password_hash);

    if (!matched) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    let sellerApproved = true;

    if (user.role === 'seller' && user.email !== 'sanjaypoojary56@gmail.com') {
      const approvalResult = await pool.query(
        'SELECT status FROM seller_registration_approvals WHERE user_id = $1',
        [user.id]
      );
      const sellerApprovalStatus = approvalResult.rows[0]?.status;

      if (sellerApprovalStatus === 'rejected') {
        return res.status(403).json({ success: false, message: 'Seller registration rejected by authorizer' });
      }

      sellerApproved = sellerApprovalStatus === 'approved';
      sellerApproved = approvalResult.rows[0]?.status === 'approved';
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      is_authorizer: user.role === 'seller' && user.email === 'sanjaypoojary56@gmail.com',
      seller_approved: sellerApproved
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

app.post('/api/products', requireSeller, upload.array('images', maxProductImages), async (req, res) => {
  const cloudinaryConfigured =
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET;

  try {
    const { name, price, stock, category_id, category_name } = req.body;

    const normalizedCategoryName = category_name ? category_name.trim() : '';

    if (!name || !price || (!category_id && !normalizedCategoryName)) {
      return res.status(400).json({ success: false, message: 'Missing required product fields' });
    }

    const uploadedFiles = req.files || [];

    if (!uploadedFiles.length && !req.body.image_url) {
      return res.status(400).json({ success: false, message: 'Product image is required' });
    }

    let finalCategoryId = category_id;

    if (!finalCategoryId && normalizedCategoryName) {
      const existingCategory = await pool.query('SELECT id FROM categories WHERE LOWER(name) = LOWER($1)', [
        normalizedCategoryName
      ]);

      if (existingCategory.rows.length) {
        finalCategoryId = existingCategory.rows[0].id;
      } else {
        finalCategoryId = (
          await pool.query('INSERT INTO categories(name) VALUES($1) RETURNING id', [normalizedCategoryName])
        ).rows[0].id;
      }
    }

    const imageUrls = [];

    if (uploadedFiles.length) {
      for (const file of uploadedFiles) {
        let imageUrl = null;

        if (cloudinaryConfigured) {
          try {
            const uploadOptions = isHeicImage(file)
              ? {
                  resource_type: 'image',
                  format: 'jpg'
                }
              : undefined;

            const uploaded = await cloudinary.uploader.upload(file.path, uploadOptions);
            imageUrl = uploaded.secure_url;
          } catch (_uploadError) {
            return res.status(502).json({
              success: false,
              message: 'Could not upload image. Please verify Cloudinary credentials and try again.'
            });
          }
        }

        imageUrls.push(imageUrl || `/uploads/${file.filename}`);
      }
    } else if (req.body.image_url) {
      imageUrls.push(req.body.image_url);
    }

    const storedImageValue = JSON.stringify(imageUrls);

    const result = await pool.query(
      `INSERT INTO products(seller_id, category_id, name, price, stock, image_url)
       VALUES($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.session.user.id, finalCategoryId, name, Number(price), Number(stock) || 0, storedImageValue]
    );

    return res.json({
      success: true,
      product: {
        ...result.rows[0],
        image_urls: normalizeStoredImageList(result.rows[0])
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Could not add product' });
  } finally {
    if (cloudinaryConfigured && req.files?.length) {
      await Promise.all(req.files.map((file) => fs.unlink(file.path).catch(() => {})));
    }
  }
});

app.get('/api/cart', requireLogin, async (req, res) => {
  try {
    if (req.session.user.role !== 'buyer') {
      return res.status(403).json({ success: false, message: 'Only buyers can view cart' });
    }

    const result = await pool.query(
      `SELECT c.id, c.quantity, p.id AS product_id, p.name, p.price, p.image_url
       FROM cart c
       JOIN products p ON p.id = c.product_id
       WHERE c.buyer_id = $1
       ORDER BY c.id DESC`,
      [req.session.user.id]
    );

    return res.json({
      success: true,
      items: result.rows.map((item) => ({
        ...item,
        image_urls: normalizeStoredImageList(item)
      }))
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Could not load cart' });
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

    return res.json(result.rows.map((product) => ({ ...product, image_urls: normalizeStoredImageList(product) })));
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

app.get('/api/buyer/orders', requireLogin, async (req, res) => {
  try {
    if (req.session.user.role !== 'buyer') {
      return res.status(403).json({ success: false, message: 'Only buyers can view delivery status' });
    }

    const result = await pool.query(
      `SELECT o.id, o.quantity, o.total_price, o.address, o.payment_method, o.status, o.created_at,
              p.name AS product_name, p.image_url
       FROM orders o
       JOIN products p ON p.id = o.product_id
       WHERE o.buyer_id = $1
       ORDER BY o.created_at DESC`,
      [req.session.user.id]
    );

    return res.json({ success: true, orders: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Could not load delivery status' });
  }
});

app.patch('/api/buyer/orders/:id/cancel', requireLogin, async (req, res) => {
  const client = await pool.connect();

  try {
    if (req.session.user.role !== 'buyer') {
      return res.status(403).json({ success: false, message: 'Only buyers can cancel orders' });
    }

    const { id } = req.params;
    await client.query('BEGIN');

    const orderResult = await client.query(
      `SELECT o.id, o.status, o.quantity, o.product_id
       FROM orders o
       WHERE o.id = $1 AND o.buyer_id = $2
       FOR UPDATE`,
      [id, req.session.user.id]
    );

    if (!orderResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const order = orderResult.rows[0];

    if (!['Processing', 'Packed'].includes(order.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'This order can no longer be cancelled' });
    }

    const cancelledOrder = await client.query(
      `UPDATE orders
       SET status = 'Cancelled'
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    await client.query('UPDATE products SET stock = stock + $1 WHERE id = $2', [order.quantity, order.product_id]);

    await client.query('COMMIT');
    return res.json({ success: true, order: cancelledOrder.rows[0] });
  } catch (_error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, message: 'Could not cancel order' });
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

app.get('/api/seller/products', requireSeller, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.name, p.price, p.stock, p.created_at, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.seller_id = $1
       ORDER BY p.created_at DESC`,
      [req.session.user.id]
    );

    return res.json({ success: true, products: result.rows });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Could not load products' });
  }
});

app.get('/api/authorizer/orders', requireAuthorizer, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.id, o.quantity, o.total_price, o.address, o.payment_method, o.status, o.created_at,
              p.name AS product_name, s.username AS seller_name, b.username AS buyer_name
       FROM orders o
       JOIN products p ON p.id = o.product_id
       JOIN users b ON b.id = o.buyer_id
       JOIN users s ON s.id = p.seller_id
       ORDER BY o.created_at DESC`
    );

    return res.json({ success: true, orders: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Could not load authorizer orders' });
  }
});

app.get('/api/authorizer/seller-registrations', requireAuthorizer, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.email, u.phone, sra.status, sra.created_at, sra.reviewed_at
       FROM seller_registration_approvals sra
       JOIN users u ON u.id = sra.user_id
       WHERE u.role = 'seller'
       ORDER BY sra.created_at DESC`
    );

    return res.json({ success: true, sellers: result.rows });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Could not load seller registrations' });
  }
});

app.patch('/api/authorizer/seller-registrations/:id', requireAuthorizer, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid approval status' });
    }

    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE seller_registration_approvals
       SET status = $1, reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW()
       WHERE user_id = $3
       RETURNING user_id, status, reviewed_at`,
      [status, req.session.user.id, id]
    );

    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Seller registration not found' });
    }

    if (status === 'rejected') {
      await client.query(`UPDATE users SET role = 'buyer' WHERE id = $1`, [id]);
    }

    await client.query('COMMIT');
    return res.json({ success: true, seller: result.rows[0] });
  } catch (_error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, message: 'Could not update seller approval' });
  } finally {
    client.release();
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

app.patch('/api/seller/orders/:id/cancel', requireSeller, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    await client.query('BEGIN');

    const orderResult = await client.query(
      `SELECT o.id, o.status, o.quantity, o.product_id
       FROM orders o
       JOIN products p ON p.id = o.product_id
       WHERE o.id = $1 AND p.seller_id = $2
       FOR UPDATE`,
      [id, req.session.user.id]
    );

    if (!orderResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const order = orderResult.rows[0];

    if (!['Processing', 'Packed'].includes(order.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Only incoming orders can be cancelled' });
    }

    const cancelledOrder = await client.query(
      `UPDATE orders
       SET status = 'Cancelled'
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    await client.query('UPDATE products SET stock = stock + $1 WHERE id = $2', [order.quantity, order.product_id]);

    await client.query('COMMIT');
    return res.json({ success: true, order: cancelledOrder.rows[0] });
  } catch (_error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, message: 'Could not cancel order' });
  } finally {
    client.release();
  }
});

app.delete('/api/seller/products/:id', requireSeller, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    await client.query('BEGIN');

    const productResult = await client.query(
      `SELECT id
       FROM products
       WHERE id = $1 AND seller_id = $2
       FOR UPDATE`,
      [id, req.session.user.id]
    );

    if (!productResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const activeOrders = await client.query(
      `SELECT id
       FROM orders
       WHERE product_id = $1
         AND status NOT IN ('Cancelled', 'Delivered')
       LIMIT 1`,
      [id]
    );

    if (activeOrders.rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Cannot remove product with active orders' });
    }

    await client.query('DELETE FROM cart WHERE product_id = $1', [id]);
    await client.query('DELETE FROM products WHERE id = $1 AND seller_id = $2', [id, req.session.user.id]);

    await client.query('COMMIT');
    return res.json({ success: true });
  } catch (_error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, message: 'Could not remove product' });
  } finally {
    client.release();
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
