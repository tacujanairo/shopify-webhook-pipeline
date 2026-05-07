const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const http = require("http");
const PORT = 3000;

let db;

// 1. Initialize the DB with Promise support
(async () => {
    db = await open({
        filename: "./sql/shopify.db",
        driver: sqlite3.Database
    });
    console.log("📂 Database connected (Modern Mode)");
})();

const server = http.createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/webhook") {
        let body = "";

        // Collect data chunks
        for await (const chunk of req) {
            body += chunk;
        }

        try {
            console.log("🔥 WEBHOOK RECEIVED");
            const data = JSON.parse(body);

            // NORMALIZE (This is just a pure function, no DB)
            const normalized = normalizeShopifyOrder(data);

            // --- THE CLEAN SEQUENCE ---
            // Each "await" means: "Stop here until the DB confirms it's done"

            await saveWebhookEvent(req.headers, body);

            await upsertCustomer(normalized.customer);

            // Now we can insert the order because we KNOW the customer exists
            const dbOrderId = await insertOrder(normalized.customer.email, normalized.order);
            await insertOrderItems(dbOrderId, normalized.items);

            console.log(`✅ Order ${normalized.order.shopify_order_id} and items saved.`);

        } catch (err) {
            console.error("❌ Error processing webhook:", err.message);
        }

        res.writeHead(200);
        res.end("OK");
    } else {
        res.end("Server running");
    }
});

async function saveWebhookEvent(headers, body) { // Use SQL's clock, not JS
    return db.run(
        `INSERT OR IGNORE INTO webhook_events
        (event_id, event_type, payload, processed_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
        [headers["x-shopify-webhook-id"], headers["x-shopify-topic"], body]
    );
}

async function upsertCustomer(customer) {
    return db.run(
        `INSERT OR IGNORE INTO customers (shopify_customer_id, email, first_name, last_name)
         VALUES (?, ?, ?, ?)`,
        [customer.shopify_customer_id, customer.email, customer.first_name, customer.last_name]
    );
}

async function insertOrder(email, order) {
    const customer = await db.get(`SELECT id FROM customers WHERE email = ?`, [email]);
    if (!customer) throw new Error("Customer not found");

    // We use 'db.run' but we need the 'lastID' to link line items
    const result = await db.run(
        `INSERT OR IGNORE INTO orders
        (shopify_order_id, customer_id, created_at, total_price, currency,
         shipping_name, shipping_city, shipping_country, financial_status, fulfillment_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [order.shopify_order_id, customer.id, order.created_at, order.total_price,
         order.currency, order.shipping_name, order.shipping_city,
         order.shipping_country, order.financial_status, order.fulfillment_status]
    );

    // If the order already existed (INSERT IGNORE), result.lastID might be useless.
    // So we fetch the actual ID of the order in the DB.
    const row = await db.get(`SELECT id FROM orders WHERE shopify_order_id = ?`, [order.shopify_order_id]);
    return row.id;
}

async function insertOrderItems(orderId, items) {
    for (const item of items) {
        // 1. Ensure the product exists first (or the Foreign Key will fail)
        await db.run(
            `INSERT OR IGNORE INTO products (id, title, price) VALUES (?, ?, ?)`,
            [item.product_id, item.title, item.price]
        );

        // 2. Insert the line item linked to the order
        await db.run(
            `INSERT INTO order_items (order_id, product_id, title, quantity, price)
             VALUES (?, ?, ?, ?, ?)`,
            [orderId, item.product_id, item.title, item.quantity, item.price]
        );
    }
}

function normalizeShopifyOrder(data) {
    return {
        // 🔹 customer table
        customer: {
            shopify_customer_id: data.customer?.id || null, // optional if you add later
            email: data.customer?.email || data.email || "no-email@example.com",
            first_name: data.customer?.first_name || null,
            last_name: data.customer?.last_name || null
        },

        // 🔹 orders table
        order: {
            shopify_order_id: data.id || null, // useful for idempotency later
            created_at: data.created_at || new Date().toISOString(),
            total_price: parseFloat(data.total_price) || 0,
            currency: data.currency || "PHP",

            shipping_name: data.shipping_address?.name || null,
            shipping_city: data.shipping_address?.city || null,
            shipping_country: data.shipping_address?.country || null,

            financial_status: mapFinancialStatus(data.financial_status),
            fulfillment_status: mapFulfillmentStatus(data.fulfillment_status)
        },

        // 🔹 order_items table
        items: (data.line_items || []).map(item => ({
            product_id: item.product_id || 0,
            title: item.title || "NO_TITLE",
            quantity: item.quantity || 0,
            price: parseFloat(item.price) || 0
        }))
    };
}

function mapFinancialStatus(status) {
    switch (status) {
        case "pending": return 0;
        case "authorized": return 1;
        case "paid": return 2;
        case "refunded": return 3;
        default: return 0;
    }
}

function mapFulfillmentStatus(status) {
    switch (status) {
        case null: return 0;
        case "partial": return 1;
        case "fulfilled": return 2;
        case "shipped": return 3;
        case "delivered": return 4;
        case "returned": return 5;
        default: return 0;
    }
}
function sendToAirtable(data) {
    console.log("📦 Sending to Airtable...");
    console.log(data);
}

function sendToHubSpot(data) {
    console.log("📇 Sending to HubSpot...");
    console.log(data);
}

server.listen(PORT, () => {
    console.log(`Listening on ${PORT}`);
});



/*

git add .
git commit -m "shopify"
git push



git clone git@github.com:tacujanairo/shopify-webhook-pipeline.git webhook-app


git pull











git log --oneline

git revert a1b2c3d

safe view: git checkout a1b2c3d
git reset --hard a1b2c3d

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

https://github.com/tacujanairo/shopify-webhook-pipeline.git

use ssh not http

git remote set-url origin git@github.com:tacujanairo/shopify-webhook-pipeline.git
git remote -v

pm2
*/
