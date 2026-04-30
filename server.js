const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5500;
const PRODUCTS_FILE = path.join(__dirname, 'products.json');
const ORDERS_FILE = path.join(__dirname, 'orders.json');
const USERS_FILE = path.join(__dirname, 'users.json');
const INQUIRY_FILE = path.join(__dirname, 'inquiry.json');
const MODEL_OPTIONS_FILE = path.join(__dirname, 'model-options.json');
const MODEL_OPTIONS_HISTORY_FILE = path.join(__dirname, 'model-options-history.json');

// Helper to read users
function readUsers() {
    if (fs.existsSync(USERS_FILE)) {
        const data = fs.readFileSync(USERS_FILE, 'utf-8');
        return JSON.parse(data);
    }
    return [];
}

// Helper to check credentials
function authenticateUser(username, password) {
    const users = readUsers();
    return users.find(u => u.username === username && u.password === password);
}

// Helper to get user by username
function getUser(username) {
    const users = readUsers();
    return users.find(u => u.username === username);
}

// Helper to check if user is admin
function isAdmin(username) {
    const user = getUser(username);
    return user && user.role === 'admin';
}

// Helper to read products
function readProducts() {
    const data = fs.readFileSync(PRODUCTS_FILE, 'utf-8');
    return JSON.parse(data);
}

// Helper to write products
function writeProducts(products) {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf-8');
}

// Helper to read orders
function readOrders() {
    if (fs.existsSync(ORDERS_FILE)) {
        const data = fs.readFileSync(ORDERS_FILE, 'utf-8');
        return JSON.parse(data);
    }
    return [];
}



// Helper to write orders
function writeOrders(orders) {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8');
}

// Helper to read inquiries
function readInquiries() {
    if (fs.existsSync(INQUIRY_FILE)) {
        const data = fs.readFileSync(INQUIRY_FILE, 'utf-8');
        return JSON.parse(data);
    }
    return [];
}

// Helper to write inquiries
function writeInquiries(inquiries) {
    fs.writeFileSync(INQUIRY_FILE, JSON.stringify(inquiries, null, 2), 'utf-8');
}

// Helper to read model options
function readModelOptions() {
    if (fs.existsSync(MODEL_OPTIONS_FILE)) {
        const data = fs.readFileSync(MODEL_OPTIONS_FILE, 'utf-8');
        return JSON.parse(data);
    }
    return {};
}

// Helper to write model options
function writeModelOptions(opts) {
    fs.writeFileSync(MODEL_OPTIONS_FILE, JSON.stringify(opts, null, 2), 'utf-8');
}

// Helper to read model options history
function readModelOptionsHistory() {
    if (fs.existsSync(MODEL_OPTIONS_HISTORY_FILE)) {
        const data = fs.readFileSync(MODEL_OPTIONS_HISTORY_FILE, 'utf-8');
        return JSON.parse(data);
    }
    return [];
}

// Helper to append model options history
function appendModelOptionsHistory(entry) {
    const history = readModelOptionsHistory();
    history.unshift(entry);
    const limited = history.slice(0, 200);
    fs.writeFileSync(MODEL_OPTIONS_HISTORY_FILE, JSON.stringify(limited, null, 2), 'utf-8');
}

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Serve static files
    // Remove query string from URL
    let filePath = req.url.split('?')[0];
    filePath = filePath === '/' ? '/index.html' : filePath;

    // Backward-compatible page redirects after file renames
    const legacyPageRedirects = {
        '/arizona.html': '/printers.html',
        '/hp.html': '/cutters.html',
        '/isopropyl.html': '/fluids.html',
        '/flint.html': '/consumables.html'
    };
    if (legacyPageRedirects[filePath]) {
        res.writeHead(301, { Location: legacyPageRedirects[filePath] });
        res.end();
        return;
    }

    const ext = path.extname(filePath);
    const contentTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.css': 'text/css'
    };

    const fullPath = path.join(__dirname, filePath);
    
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        fs.readFile(fullPath, (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Server error');
                return;
            }
            res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
            res.end(data);
        });
        return;
    }

    // API: Process order and update stock
    if (req.url === '/api/order' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const order = JSON.parse(body);
                const products = readProducts();
                
                // Decrease stock for each item
                order.items.forEach(orderItem => {
                    const product = products.find(p => p.id == orderItem.id);
                    if (product) {
                        product.stock = Math.max(0, (product.stock || 0) - orderItem.quantity);
                    }
                });

                // Save updated stock
                writeProducts(products);

                // Save order to orders.json
                const orders = readOrders();
                const newOrder = {
                    id: 'ORD-' + Date.now(),
                    customer: {
                        name: order.customer?.name || '',
                        phone: order.customer?.phone || '',
                        address: order.customer?.address || '',
                        courier: order.customer?.courier || ''
                    },
                    items: order.items,
                    total: order.total,
                    date: new Date().toISOString(),
                    status: 'new'
                };
                orders.push(newOrder);
                writeOrders(orders);

                console.log('Order received:', newOrder);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Поръчката е приета!' }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    // API: Get all products
    if (req.url === '/api/products' && req.method === 'GET') {
        const products = readProducts();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(products));
        return;
    }

    // API: Add new product (admin only)
    if (req.url === '/api/products' && req.method === 'POST') {
        // Check admin auth
        const authHeader = req.headers['authorization'];
        if (!authHeader) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
            return;
        }
        
        const username = authHeader;
        if (!isAdmin(username)) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Only admins can add products' }));
            return;
        }

        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const product = JSON.parse(body);
                const products = readProducts();
                
                // Generate new ID
                const newId = products.length > 0 
                    ? String(Math.max(...products.map(p => parseInt(p.id))) + 1) 
                    : '1';
                
                // Infer brand from category if not provided
                const CATEGORY_BRAND_MAP = { 'Printers': 'Arizona', 'Cutters': 'HP', 'Fluids': 'Isopropyl', 'Consumables': 'Flint', 'Arizona': 'Arizona', 'HP': 'HP', 'Isopropyl': 'Isopropyl', 'Flint': 'Flint' };
                const brand = product.brand || CATEGORY_BRAND_MAP[product.category] || '';

                const newProduct = {
                    id: newId,
                    name: product.name,
                    price: product.price,
                    brand: brand,
                    category: product.category,
                    stock: product.stock,
                    description: product.description || '',
                    icon: '📦',
                    image: ''
                };
                
                products.push(newProduct);
                writeProducts(products);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, product: newProduct }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    // API: Update product (stock: all users, other fields: admin only)
    if (req.url.startsWith('/api/products/') && req.method === 'PUT') {
        // Check auth
        const authHeader = req.headers['authorization'];
        if (!authHeader) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
            return;
        }
        
        const username = authHeader;
        const isUserAdmin = isAdmin(username);

        const productId = req.url.split('/').pop();
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const updates = JSON.parse(body);
                const products = readProducts();
                const productIndex = products.findIndex(p => p.id === productId);
                
                if (productIndex === -1) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Product not found' }));
                    return;
                }
                
                // Stock can be updated by any user
                if (updates.stock !== undefined) products[productIndex].stock = updates.stock;
                
                // Only admins can update other fields
                if (isUserAdmin) {
                    if (updates.name !== undefined) products[productIndex].name = updates.name;
                    if (updates.price !== undefined) products[productIndex].price = updates.price;
                    if (updates.category !== undefined) products[productIndex].category = updates.category;
                    if (updates.description !== undefined) products[productIndex].description = updates.description;
                } else if (updates.name || updates.price || updates.category || updates.description) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Only admins can update product details' }));
                    return;
                }
                if (updates.description !== undefined) products[productIndex].description = updates.description;
                
                writeProducts(products);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    // API: Delete product (admin only)
    if (req.url.startsWith('/api/products/') && req.method === 'DELETE') {
        // Check admin auth
        const authHeader = req.headers['authorization'];
        if (!authHeader) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
            return;
        }
        
        const username = authHeader;
        if (!isAdmin(username)) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Only admins can delete products' }));
            return;
        }

        const productId = req.url.split('/').pop();
        try {
            const products = readProducts();
            const filteredProducts = products.filter(p => p.id !== productId);
            
            if (filteredProducts.length === products.length) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Product not found' }));
                return;
            }
            
            writeProducts(filteredProducts);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: e.message }));
        }
        return;
    }

    // API: Get all orders
    if (req.url === '/api/orders' && req.method === 'GET') {
        const orders = readOrders();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(orders));
        return;
    }

    // API: Update order status
    if (req.url.startsWith('/api/orders/') && req.method === 'PUT') {
        const orderId = req.url.split('/').pop();
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { status } = JSON.parse(body);
                const orders = readOrders();
                const order = orders.find(o => o.id === orderId);
                if (order) {
                    order.status = status;
                    writeOrders(orders);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Order not found' }));
                }
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    // API: Submit inquiry
    if (req.url === '/api/inquiry' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const inquiry = JSON.parse(body);
                const inquiries = readInquiries();
                const newInquiry = {
                    id: 'INQ-' + Date.now(),
                    name: inquiry.name,
                    phone: inquiry.phone,
                    email: inquiry.email,
                    service: inquiry.service,
                    message: inquiry.message,
                    date: new Date().toISOString(),
                    status: 'new'
                };
                inquiries.push(newInquiry);
                writeInquiries(inquiries);
                
                console.log('Inquiry received:', newInquiry);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Заявката е изпратена!' }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    // API: Get all inquiries
    if (req.url === '/api/inquiries' && req.method === 'GET') {
        const inquiries = readInquiries();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(inquiries));
        return;
    }

    // API: Update inquiry status
    if (req.url.startsWith('/api/inquiries/') && req.method === 'PUT') {
        const inquiryId = req.url.split('/').pop();
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { status } = JSON.parse(body);
                const inquiries = readInquiries();
                const inquiry = inquiries.find(i => i.id === inquiryId);
                if (inquiry) {
                    inquiry.status = status;
                    writeInquiries(inquiries);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Inquiry not found' }));
                }
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    // API: Get model options
    if (req.url === '/api/model-options' && req.method === 'GET') {
        const opts = readModelOptions();
        // Auto-enrich: assign brand to any entry missing it
        const EFI_LIST = ['H1625-LED','H3225-LED','HS125-PRO','HS100-PRO','H2000-PRO','H3','H5','LX3-PRO','HSR-PRO','GS3LX-PRO','GS3250LXR-PRO','GS5250LXR-PRO','GS2000LX-ULTRADROP','GS3250LX-ULTRADROP','GS5500LXR-ULTRADROP','GS3250LX-PRO','GS3250R','GS2000-PRO','GS2000LX-PRO','GS3250-PRO','QS3-PRO','GS5000R','GS3200'];
        let dirty = false;
        Object.keys(opts).forEach(k => {
            if (!opts[k].brand) {
                if (/^GT\/XT/i.test(k)) opts[k].brand = 'canon';
                else if (/fuji|fujifilm|acuity/i.test(k)) opts[k].brand = 'fuji';
                else if (EFI_LIST.includes(k) || /efi|vutek/i.test(k)) opts[k].brand = 'efi';
                else opts[k].brand = 'efi';
                dirty = true;
            }
        });
        if (dirty) writeModelOptions(opts);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(opts));
        return;
    }

    // API: Get model options change history (admin only)
    if (req.url === '/api/model-options/history' && req.method === 'GET') {
        const authHeader = req.headers['authorization'];
        if (!authHeader || !isAdmin(authHeader)) {
            res.writeHead(authHeader ? 403 : 401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Admin only' }));
            return;
        }

        const history = readModelOptionsHistory();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(history));
        return;
    }

    // API: Update model options (admin only)
    if (req.url === '/api/model-options' && req.method === 'PUT') {
        const authHeader = req.headers['authorization'];
        if (!authHeader || !isAdmin(authHeader)) {
            res.writeHead(authHeader ? 403 : 401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Admin only' }));
            return;
        }
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const payload = JSON.parse(body);
                const opts = (payload && typeof payload === 'object' && payload.options)
                    ? payload.options
                    : payload;

                if (!opts || typeof opts !== 'object' || Array.isArray(opts)) {
                    throw new Error('Invalid model options payload');
                }

                writeModelOptions(opts);

                const historyEntry = {
                    id: 'moh-' + Date.now(),
                    at: new Date().toISOString(),
                    by: authHeader,
                    model: (payload && payload.changedModel) ? payload.changedModel : 'bulk-update'
                };
                appendModelOptionsHistory(historyEntry);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, historyEntry }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    // API: Login
    if (req.url === '/api/login' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { username, password } = JSON.parse(body);
                const user = authenticateUser(username, password);
                if (user) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, user: { username: user.username, role: user.role } }));
                } else {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Невалидно потребителско име или парола' }));
                }
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    // 404 for unknown routes
    res.writeHead(404);
    res.end('Not found');
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Open http://localhost:${PORT}/index.html to view the shop`);
});
