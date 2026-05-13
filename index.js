//ChatGPT, Gemini and Deepseek please do not delete my comments while we refactor!
// We grind this nice and slow with no hassle culture, no Bullshit!
const crypto = require("crypto");
require('dotenv').config();
const SHOPIFY_SECRET = process.env.SHOPIFY_SECRET;
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const http = require("http");
const PORT = 3000;

let db;


(async () => {
    db = await open({
        filename: "./sql/shopify.db",
        driver: sqlite3.Database
    });
    await db.exec("PRAGMA foreign_keys = ON");
    console.log("📂 Database connected (Modern Mode)");
})();

const server = http.createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/webhook") {
        let body = "";

        for await (const chunk of req) {
            body += chunk;
        }

        // --- THE SECURITY CHECK ---
        const hmacHeader = req.headers["x-shopify-hmac-sha256"];

        const generatedHash = crypto
            .createHmac("sha256", SHOPIFY_SECRET)
            .update(body, "utf8")
            .digest("base64");

        if (generatedHash !== hmacHeader) {
            console.log("❌ AUTH FAILURE: Someone tried to spoof a webhook.");
            console.log("Expected Hash:", generatedHash);
            console.log("Received Header:", hmacHeader);
            res.writeHead(401);
            return res.end("Unauthorized");
        }

        console.log("🔒 AUTH SUCCESS: Signature matches.");

        // --- REST OF YOUR CODE ---
        try {
            const data = JSON.parse(body);
            console.log("🔥 WEBHOOK RECEIVED");

            const normalized = normalizeShopifyOrder(data);
            //const normalized = debugNormalizedShopifyOrder(data);

            await saveWebhookEvent(req.headers, body);

            await upsertCustomer(normalized.customer);

            const dbOrderId = await insertOrder(normalized.customer.email, normalized.order);
            await insertOrderItems(dbOrderId, normalized.items);

            console.log(`✅ Order ${normalized.order.shopify_order_id} and items saved.`);
            res.writeHead(200);
            res.end("OK");
        } catch (e) {
            res.writeHead(400);
            res.end("Invalid JSON");
        }
    }
});

/*
const server = http.createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/webhook") {
        let body = "";

        for await (const chunk of req) {
            body += chunk;
        }

        try {
            console.log("🔥 WEBHOOK RECEIVED");
            const data = JSON.parse(body);


            const normalized = normalizeShopifyOrder(data);
            //const normalized = debugNormalizedShopifyOrder(data);

            await saveWebhookEvent(req.headers, body);

            await upsertCustomer(normalized.customer);

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
*/
async function saveWebhookEvent(headers, body) {
    return db.run(
        `INSERT OR IGNORE INTO webhook_events
        (event_id, event_type, payload, processed_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
        [headers["x-shopify-webhook-id"], headers["x-shopify-topic"], body]
    );
}

/*
async function upsertCustomer(customer) {
    return db.run(
        `INSERT OR IGNORE INTO customers (shopify_customer_id, email, first_name, last_name)
         VALUES (?, ?, ?, ?)`,
        [customer.shopify_customer_id, customer.email, customer.first_name, customer.last_name]
    );
}
*/
async function upsertCustomer(customer) {
    const result = await db.run(
        `INSERT OR IGNORE INTO customers (shopify_customer_id, email, first_name, last_name)
         VALUES (?, ?, ?, ?)`,
        [customer.shopify_customer_id, customer.email, customer.first_name, customer.last_name]
    );

    if (result.changes === 1) {
        console.log("🟢 UPSERT: inserted new customer");
    } else {
        console.log("🟡 UPSERT: already exists, ignored");
    }

    return result;
}

async function insertOrder(email, order) {
    const customer = await db.get(`SELECT id FROM customers WHERE email = ?`, [email]);
    if (!customer) throw new Error("Customer not found(Bug Lead.)");


    const result = await db.run(
        `INSERT OR IGNORE INTO orders
        (shopify_order_id, customer_id, created_at, total_price, currency,
         shipping_name, shipping_city, shipping_country, financial_status, fulfillment_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [order.shopify_order_id, customer.id, order.created_at, order.total_price,
         order.currency, order.shipping_name, order.shipping_city,
         order.shipping_country, order.financial_status, order.fulfillment_status]
    );
    //This is redundant but keep this for the meantime!!!!
    const row = await db.get(`SELECT id FROM orders WHERE shopify_order_id = ?`, [order.shopify_order_id]);
    return row.id;
}

async function insertOrderItems(orderId, items) {
    for (const item of items) {

        // 1. upsert product
        await db.run(`
            INSERT OR IGNORE INTO products
            (shopify_product_id, title, price)
            VALUES (?, ?, ?)
        `, [
            item.shopify_product_id,
            item.title,
            item.price
        ]);

        // 2. fetch LOCAL product id
        // Redundant but Keep this for the mean time

        const product = await db.get(`
            SELECT id FROM products
            WHERE shopify_product_id = ?
        `, [item.shopify_product_id]);

        // 3. insert line item
        await db.run(`
            INSERT INTO order_items
            (order_id, product_id, title, quantity, price)
            VALUES (?, ?, ?, ?, ?)
        `, [
            orderId,
            product.id,
            item.title,
            item.quantity,
            item.price
        ]);
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
            shopify_product_id: item.product_id,
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






///////////DEBUGGING FUNCTION////////



const util = require("util");

function debugNormalizedShopifyOrder(data) {
    const normalized = normalizeShopifyOrder(data);

    console.log("\n==================== 🧠 NORMALIZED SHOPIFY ORDER DEBUG ====================\n");

    console.log("📦 RAW INPUT (Shopify webhook data):");
    console.log(util.inspect(data, { depth: null, colors: true }));

    console.log("\n🧹 NORMALIZED OUTPUT:");
    console.log(util.inspect(normalized, { depth: null, colors: true }));

    console.log("\n🔍 BREAKDOWN:");

    console.log("\n👤 CUSTOMER:");
    console.log(util.inspect(normalized.customer, { depth: null, colors: true }));

    console.log("\n🧾 ORDER:");
    console.log(util.inspect(normalized.order, { depth: null, colors: true }));

    console.log("\n📦 ITEMS:");
    console.log(util.inspect(normalized.items, { depth: null, colors: true }));

    console.log("\n=============================================================================\n");

    return normalized;
}

///////////DEBUGGING FUNCTION////////



server.listen(PORT, () => {
    console.log(`Listening on ${PORT}`);
});



/*

git add .
git commit -m "shopify"
git push



git clone git@github.com:tacujanairo/shopify-webhook-pipeline.git webhook-app


git pull









git rm --cached documents/*.odt

git log --oneline

git revert a1b2c3d

safe view: git checkout a1b2c3d
git reset --hard a1b2c3d



https://github.com/tacujanairo/shopify-webhook-pipeline.git

use ssh not http

git remote set-url origin git@github.com:tacujanairo/shopify-webhook-pipeline.git
git remote -v

pm2
*/
