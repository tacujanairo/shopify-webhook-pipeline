
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

server.listen(PORT, () => {
    console.log(`Listening on ${PORT}`);
});



/*

git add .
git commit -m "froggy"
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
