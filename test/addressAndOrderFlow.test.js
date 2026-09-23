require("dotenv").config();
const http = require("http");
const express = require("express");
const generateToken = require("../utils/generateToken");
const db = require("../config/db");

// Build a test Express app using the exact project routes
const app = express();
app.use(express.json());

const addressRoutes = require("../routes/addressRoutes");
const orderRoutes = require("../routes/orderRoutes");

app.use("/api/addresses", addressRoutes);
app.use("/api/orders", orderRoutes);

// Helper function to send HTTP requests to test server
function makeRequest(server, options, bodyData) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const reqOptions = {
      hostname: "127.0.0.1",
      port: address.port,
      path: options.path,
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on("error", reject);

    if (bodyData) {
      req.write(JSON.stringify(bodyData));
    }
    req.end();
  });
}

async function runTests() {
  console.log("==================================================");
  console.log("   RUNNING ADDRESS & BUY-NOW CONDITIONAL TESTS    ");
  console.log("==================================================\n");

  // Start test server on random free port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    // Pick user 2 for testing
    const testUserId = 2;
    const token = generateToken(testUserId);
    const authHeaders = { Authorization: `Bearer ${token}` };

    console.log(`Using test user_id: ${testUserId}`);

    // Ensure database table is ready
    const Address = require("../models/addressModel");
    await Address.ensureTable();

    // Clean up any previous test addresses for user 2 to start clean
    await db.query("DELETE FROM addresses WHERE user_id = ?", [testUserId]);
    console.log("✓ Reset addresses for test user\n");

    // TEST 1: Check address status when user has NO address
    console.log("TEST 1: GET /api/orders/check-address (No address filled yet)");
    const check1 = await makeRequest(
      server,
      { path: "/api/orders/check-address", method: "GET", headers: authHeaders }
    );
    console.log("Response:", check1.body);
    if (check1.status === 200 && check1.body.has_address === false && check1.body.requires_address === true) {
      console.log("✓ TEST 1 PASSED: Correctly detected user has no address filled\n");
    } else {
      throw new Error(`TEST 1 FAILED: Unexpected response: ${JSON.stringify(check1.body)}`);
    }

    // TEST 2: Buy Now when user has NO address -> Must demand address
    console.log("TEST 2: POST /api/orders/buy-now (Without address when DB has no address)");
    const buyNowWithoutAddress = await makeRequest(
      server,
      { path: "/api/orders/buy-now", method: "POST", headers: authHeaders },
      { product_id: 1, quantity: 1, payment_method: "COD" }
    );
    console.log("Status:", buyNowWithoutAddress.status, "Response:", buyNowWithoutAddress.body);
    if (
      buyNowWithoutAddress.status === 400 &&
      buyNowWithoutAddress.body.requires_address === true
    ) {
      console.log("✓ TEST 2 PASSED: Correctly blocked order and prompted user to fill address\n");
    } else {
      throw new Error(`TEST 2 FAILED: Expected requires_address=true, got: ${JSON.stringify(buyNowWithoutAddress.body)}`);
    }

    // TEST 3: Add new address matching the image fields
    console.log("TEST 3: POST /api/addresses (Matching Add Address UI fields)");
    const newAddressPayload = {
      full_name: "Raman Kumar",
      mobile_number: "9876543210",
      pincode: "110001",
      state: "Delhi",
      city: "New Delhi",
      house_no: "Flat 204, Galaxy Heights",
      area_street: "Connaught Place",
      landmark: "Near Metro Gate 3",
      address_type: "Home",
      is_default: 1,
    };
    const addRes = await makeRequest(
      server,
      { path: "/api/addresses", method: "POST", headers: authHeaders },
      newAddressPayload
    );
    console.log("Status:", addRes.status, "Address Created ID:", addRes.body.data && addRes.body.data.address.id);
    if (addRes.status === 201 && addRes.body.success === true) {
      console.log("✓ TEST 3 PASSED: Address saved successfully\n");
    } else {
      throw new Error(`TEST 3 FAILED: Could not save address: ${JSON.stringify(addRes.body)}`);
    }
    const savedAddressId = addRes.body.data.address.id;

    // TEST 4: GET /api/addresses & GET /api/addresses/default
    console.log("TEST 4: GET /api/addresses & GET /api/addresses/default");
    const listRes = await makeRequest(
      server,
      { path: "/api/addresses", method: "GET", headers: authHeaders }
    );
    const defRes = await makeRequest(
      server,
      { path: "/api/addresses/default", method: "GET", headers: authHeaders }
    );
    console.log("List count:", listRes.body.count, "Default address ID:", defRes.body.data && defRes.body.data.id);
    if (listRes.body.count >= 1 && defRes.body.data.id === savedAddressId) {
      console.log("✓ TEST 4 PASSED: Retrieved user address and default address\n");
    } else {
      throw new Error("TEST 4 FAILED: Address listing or default address mismatch");
    }

    // TEST 5: Buy Now when user's address IS filled -> Order directly placed ("sidha order ho")
    console.log("TEST 5: POST /api/orders/buy-now (Address is already filled -> Directly order)");
    const buyNowDirect = await makeRequest(
      server,
      { path: "/api/orders/buy-now", method: "POST", headers: authHeaders },
      { product_id: 1, quantity: 1, payment_method: "COD" }
    );
    console.log("Status:", buyNowDirect.status, "Order Number:", buyNowDirect.body.data && buyNowDirect.body.data.order.order_number);
    console.log("Shipping address used:", buyNowDirect.body.data && buyNowDirect.body.data.order.shipping_address);
    if (
      buyNowDirect.status === 201 &&
      buyNowDirect.body.success === true &&
      buyNowDirect.body.data.order.shipping_name === "Raman Kumar"
    ) {
      console.log("✓ TEST 5 PASSED: Address was found, order placed directly without asking again!\n");
    } else {
      throw new Error(`TEST 5 FAILED: Direct order failed: ${JSON.stringify(buyNowDirect.body)}`);
    }

    // TEST 6: Buy Now with specific address_id
    console.log("TEST 6: POST /api/orders/buy-now with explicit address_id");
    const buyNowWithAddressId = await makeRequest(
      server,
      { path: "/api/orders/buy-now", method: "POST", headers: authHeaders },
      { product_id: 2, quantity: 1, address_id: savedAddressId }
    );
    if (buyNowWithAddressId.status === 201) {
      console.log("✓ TEST 6 PASSED: Order created using specified address_id\n");
    } else {
      throw new Error(`TEST 6 FAILED: ${JSON.stringify(buyNowWithAddressId.body)}`);
    }

    // TEST 7: Update address and toggle default
    console.log("TEST 7: PUT /api/addresses/:id & PATCH /api/addresses/:id/default");
    const updateRes = await makeRequest(
      server,
      { path: `/api/addresses/${savedAddressId}`, method: "PUT", headers: authHeaders },
      { landmark: "Opposite City Mall" }
    );
    console.log("Updated landmark:", updateRes.body.data && updateRes.body.data.landmark);
    if (updateRes.status === 200 && updateRes.body.data.landmark === "Opposite City Mall") {
      console.log("✓ TEST 7 PASSED: Address updated successfully\n");
    } else {
      throw new Error("TEST 7 FAILED: Address update failed");
    }

    console.log("==================================================");
    console.log("   ALL ADDRESS & BUY-NOW TESTS PASSED 100%!       ");
    console.log("==================================================");
    server.close();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ TEST ERROR:", error);
    server.close();
    process.exit(1);
  }
}

runTests();
