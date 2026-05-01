
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
              sendToAirtable(normalized);
              sendToHubSpot(normalized);

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
    // We use "OR" ( || ) to provide a fallback value if the data is missing
    return {
        id: data.id || "NO_ID_PROVIDED",
        email: data.email || "no-email@example.com",
        total: data.total_price || 0,
        created_at: data.created_at || new Date().toISOString()
    };
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



git log --oneline

git revert a1b2c3d

safe view: git checkout a1b2c3d
git reset --hard a1b2c3d

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

https://github.com/tacujanairo/shopify-webhook-pipeline.git
*/
