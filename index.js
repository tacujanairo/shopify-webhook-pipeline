
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./sql/shopify.db");
const http = require("http");
const PORT = 3000;

const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/webhook") {

        let body = "";

        req.on("data", (chunk) => {
            body += chunk.toString();
        });


        req.on("end", () => {
            console.log("🔥 WEBHOOK RECEIVED");

            try {
                const data = JSON.parse(body);


                // 1. store raw webhook FIRST
                saveWebhookEvent(req.headers, body);

                // 2. normalize
                const normalized = normalizeShopifyOrder(data);

                console.log("✅ Normalized Data:");
                console.log(normalized);
                // 2. store customer
                upsertCustomer(normalized.customer);

                // 3. store order AFTER small delay (temporary simple flow)
                setTimeout(() => {
                    insertOrder(normalized.customer.email, normalized.order, normalized.items);
                }, 50);


            } catch (err) {
                console.error("❌ JSON parse error:", err.message);
            }

            res.writeHead(200);
            res.end("OK");
        });

/*
        req.on("end", () => {
          console.log("🔥 WEBHOOK RECEIVED");

          try {
              const data = JSON.parse(body);

              // 🧠 Normalize
              const normalized = normalizeShopifyOrder(data);

              console.log("✅ Normalized Data:");
              console.log(normalized);

              // 🧠 Send to services
              //sendToAirtable(normalized);
              //sendToHubSpot(normalized);

          } catch (err) {
              console.error("❌ JSON parse error:", err.message);
          }

          res.writeHead(200);
          res.end("OK");
        });
*/
    } else {
        res.end("Server running");
    }
});

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

function saveWebhookEvent(headers, body) {
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO webhook_events
        (event_id, event_type, payload, processed_at)
        VALUES (?, ?, ?, NULL)              // <- Lagyan mo ng Date ito!!!!
    `);

    stmt.run(
        headers["x-shopify-webhook-id"] || null,
        headers["x-shopify-topic"] || "unknown",
        body
    );

    stmt.finalize();
}

function upsertCustomer(customer) {
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO customers
        (shopify_customer_id, email, first_name, last_name)
        VALUES (?, ?, ?, ?)
    `);

    stmt.run(
        customer.shopify_customer_id,
        customer.email,
        customer.first_name,
        customer.last_name
    );

    stmt.finalize();
}

function insertOrder(customerEmail, order, items) {
    db.get(
        `SELECT id FROM customers WHERE email = ?`,
        [customerEmail],
        (err, customer) => {
            if (err || !customer) return;

            db.run(
                `INSERT OR IGNORE INTO orders
                (shopify_order_id, customer_id, created_at, total_price, currency,
                 shipping_name, shipping_city, shipping_country,
                 financial_status, fulfillment_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
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
                ]
            );
        }
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
