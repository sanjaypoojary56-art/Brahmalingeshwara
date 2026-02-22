require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Cloudinary setup
cloudinary.config({ url: process.env.CLOUDINARY_URL });
const storage = new CloudinaryStorage({
    cloudinary,
    params: { folder: 'lamp-shop' }
});
const upload = multer({ storage });

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));
app.use(express.static(path.join(__dirname, 'public')));

// ======== ROUTES ========

// Seller - Add Product
app.post('/api/products', upload.single('image'), async (req, res) => {
    try {
        const { name, description, price } = req.body;
        const seller_id = req.session.user_id; // assuming seller is logged in
        if(!req.file) return res.json({ success:false, message:'Image required' });
        const image_url = req.file.path;

        await pool.query(
            'INSERT INTO products (seller_id,name,description,price,image_url) VALUES ($1,$2,$3,$4,$5)',
            [seller_id,name,description,price,image_url]
        );
        res.json({ success:true });
    } catch(err){
        console.error(err);
        res.json({ success:false, message:'Server error' });
    }
});

// Seller - Get Products
app.get('/api/seller/products', async (req,res) => {
    try{
        const seller_id = req.session.user_id;
        const result = await pool.query('SELECT * FROM products WHERE seller_id=$1 ORDER BY created_at DESC', [seller_id]);
        res.json(result.rows);
    } catch(err){ console.error(err); res.json([]); }
});

// Seller - Delete Product
app.delete('/api/products/:id', async (req,res) => {
    try{
        const productId = req.params.id;
        await pool.query('DELETE FROM products WHERE id=$1', [productId]);
        res.json({ success:true });
    } catch(err){ console.error(err); res.json({ success:false }); }
});

// Buyer - Get All Products
app.get('/api/products', async (req,res) => {
    try{
        const result = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
        res.json(result.rows);
    } catch(err){ console.error(err); res.json([]); }
});

// ======== Start Server ========
app.listen(PORT, ()=>console.log(`Server running on port ${PORT}`));
