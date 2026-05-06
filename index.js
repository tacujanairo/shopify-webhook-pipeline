const Database = require("better-sqlite3");
const http = require("http");

const db = new Database("./sql/shopify.db");

const PORT = 3000;

const server = http.createServer((req, res) => {

    if (req.method === "POST" && req.url === "/webhook") {

        let body = "";

        req.on("data", (chunk) => {
            body += chunk.toString();
        });

        req.on("end", () => {

            try {

                console.log("🔥 WEBHOOK RECEIVED");

                const data = JSON.parse(body);

                // normalize
                const normalized = normalizeShopifyOrder(data);

                // 1. save webhook
                saveWebhookEvent(req.headers, body);

                // 2. customer FIRST
                upsertCustomer(normalized.customer);

                // 3. THEN order
                insertOrder(
                    normalized.customer.shopify_customer_id,
                    normalized.order
                );

                console.log("✅ DONE");

            } catch (err) {
                console.error("❌ ERROR:", err.message);
            }

            res.writeHead(200);
            res.end("OK");
        });

    } else {
        res.end("Server running");
    }
});



function saveWebhookEvent(headers, body) {

    const stmt = db.prepare(`
        INSERT OR IGNORE INTO webhook_events
        (event_id, event_type, payload, processed_at)
        VALUES (?, ?, ?, NULL)
    `);

    stmt.run(
        headers["x-shopify-webhook-id"] || null,
        headers["x-shopify-topic"] || "unknown",
        body
    );
}



function upsertCustomer(customer) {

    const stmt = db.prepare(`
        INSERT INTO customers
        (shopify_customer_id, email, first_name, last_name)
        VALUES (?, ?, ?, ?)

        ON CONFLICT(shopify_customer_id)
        DO UPDATE SET
            email = excluded.email,
            first_name = excluded.first_name,
            last_name = excluded.last_name
    `);

    stmt.run(
        customer.shopify_customer_id,
        customer.email,
        customer.first_name,
        customer.last_name
    );
}



function insertOrder(shopifyCustomerId, order) {

    // customer already guaranteed inserted
    const customer = db.prepare(`
        SELECT id
        FROM customers
        WHERE shopify_customer_id = ?
    `).get(shopifyCustomerId);

    if (!customer) {
        throw new Error("Customer not found");
    }

    const stmt = db.prepare(`
        INSERT OR IGNORE INTO orders
        (
            shopify_order_id,
            customer_id,
            created_at,
            total_price,
            currency,
            shipping_name,
            shipping_city,
            shipping_country,
            financial_status,
            fulfillment_status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
        order.shopify_order_id,
        customer.id,
        order.created_at,
        order.total_price,
        order.currency,
        order.shipping_name,
        order.shipping_city,
        order.shipping_country,
        order.financial_status,
        order.fulfillment_status
    );
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
