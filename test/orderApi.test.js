require("dotenv").config();
const express = require("express");
const db = require("../config/db");
const orderRoutes = require("../routes/orderRoutes");
const generateToken = require("../utils/generateToken");

const app = express();
app.use(express.json());
app.use("/api/orders", orderRoutes);

let server;
const PORT = 5099;
const BASE_URL = `http://localhost:${PORT}/api/orders`;

// Test User Tokens
const user1Token = generateToken(1); // Kundan Singh
const user2Token = generateToken(2); // Raman Kumar

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // Start temporary test server
  await new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`\n=== Test Server running on port ${PORT} ===\n`);
      resolve();
    });
  });

  try {
    console.log("------------------------------------------------------------");
    console.log("STARTING TEST SUITE: MarketHub Order Management APIs");
    console.log("------------------------------------------------------------\n");

    let createdOrderId = null;
    let createdOrderNumber = null;
    const testProductId = 4; // Noise Earbuds

    // Initial stock check
    const [initialProd] = await db.query(
      "SELECT stock, price, discount_price FROM products WHERE id = ?",
      [testProductId]
    );
    const initialStock = initialProd[0].stock;
    console.log(`Product ${testProductId} Initial Stock: ${initialStock}`);

    // =========================================================================
    // 1. Buy Now - successful order
    // =========================================================================
    console.log("\n>>> Test 1: Buy Now - successful order");
    const res1 = await fetch(`${BASE_URL}/buy-now`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        product_id: testProductId,
        quantity: 2,
        payment_method: "COD",
        shipping_name: "Kundan Singh",
        shipping_phone: "9876543210",
        shipping_address: "Flat 101, Green Residency",
        shipping_city: "Patna",
        shipping_state: "Bihar",
        shipping_pincode: "800001",
      }),
    });
    const data1 = await res1.json();
    assert(res1.status === 201, `Status code is 201 (Got: ${res1.status})`);
    assert(data1.success === true, `Response success is true`);
    assert(!!data1.data?.order?.id, `Order ID returned: ${data1.data?.order?.id}`);
    assert(
      data1.data?.order?.items?.length === 1,
      `Order item snapshot present with count = 1`
    );
    assert(
      data1.data?.order?.order_status === "PLACED",
      `Order status is PLACED`
    );

    createdOrderId = data1.data?.order?.id;
    createdOrderNumber = data1.data?.order?.order_number;

    // =========================================================================
    // 2. Buy Now - invalid product
    // =========================================================================
    console.log("\n>>> Test 2: Buy Now - invalid product");
    const res2 = await fetch(`${BASE_URL}/buy-now`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        product_id: 9999999,
        quantity: 1,
        shipping_name: "Test User",
        shipping_phone: "9999999999",
        shipping_address: "Street 1",
        shipping_city: "City",
        shipping_state: "State",
        shipping_pincode: "110001",
      }),
    });
    const data2 = await res2.json();
    assert(res2.status === 404, `Status code is 404 (Got: ${res2.status})`);
    assert(data2.success === false, `Response success is false`);
    assert(
      data2.message.toLowerCase().includes("not found"),
      `Error message mentions 'not found' (${data2.message})`
    );

    // =========================================================================
    // 3. Buy Now - insufficient stock
    // =========================================================================
    console.log("\n>>> Test 3: Buy Now - insufficient stock");
    const res3 = await fetch(`${BASE_URL}/buy-now`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        product_id: testProductId,
        quantity: 999999,
        shipping_name: "Test User",
        shipping_phone: "9999999999",
        shipping_address: "Street 1",
        shipping_city: "City",
        shipping_state: "State",
        shipping_pincode: "110001",
      }),
    });
    const data3 = await res3.json();
    assert(
      res3.status === 409 || res3.status === 400,
      `Status code is 409 or 400 (Got: ${res3.status})`
    );
    assert(data3.success === false, `Response success is false`);
    assert(
      data3.message.toLowerCase().includes("stock"),
      `Error message mentions stock (${data3.message})`
    );

    // =========================================================================
    // 4. Buy Now - invalid quantity
    // =========================================================================
    console.log("\n>>> Test 4: Buy Now - invalid quantity");
    const res4 = await fetch(`${BASE_URL}/buy-now`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        product_id: testProductId,
        quantity: 0,
        shipping_name: "Test User",
        shipping_phone: "9999999999",
        shipping_address: "Street 1",
        shipping_city: "City",
        shipping_state: "State",
        shipping_pincode: "110001",
      }),
    });
    const data4 = await res4.json();
    assert(res4.status === 400, `Status code is 400 (Got: ${res4.status})`);
    assert(data4.success === false, `Response success is false`);
    assert(
      data4.message.toLowerCase().includes("quantity"),
      `Validation error mentions quantity (${data4.message})`
    );

    // =========================================================================
    // 5. Order History
    // =========================================================================
    console.log("\n>>> Test 5: Order History");
    const res5 = await fetch(`${BASE_URL}?page=1&limit=10`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${user1Token}`,
      },
    });
    const data5 = await res5.json();
    assert(res5.status === 200, `Status code is 200 (Got: ${res5.status})`);
    assert(data5.success === true, `Response success is true`);
    assert(Array.isArray(data5.data), `Orders data is an array`);
    assert(
      data5.data.some((o) => o.id === createdOrderId),
      `Newly created order ${createdOrderId} is present in user's history`
    );
    assert(
      data5.pagination && data5.pagination.currentPage === 1,
      `Pagination metadata present`
    );

    // =========================================================================
    // 6. Order Details
    // =========================================================================
    console.log("\n>>> Test 6: Order Details");
    const res6 = await fetch(`${BASE_URL}/${createdOrderId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${user1Token}`,
      },
    });
    const data6 = await res6.json();
    assert(res6.status === 200, `Status code is 200 (Got: ${res6.status})`);
    assert(data6.success === true, `Response success is true`);
    assert(
      data6.data?.order?.id === createdOrderId,
      `Correct order ID returned`
    );
    assert(
      data6.data?.order?.items?.length > 0,
      `Order items snapshot returned`
    );
    assert(
      !!data6.data?.order?.shipping_address,
      `Shipping details returned`
    );

    // =========================================================================
    // 7. Another user's order access should fail (Cross-user security)
    // =========================================================================
    console.log("\n>>> Test 7: Another user's order access should fail");
    const res7 = await fetch(`${BASE_URL}/${createdOrderId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${user2Token}`, // User 2 trying to access User 1's order
      },
    });
    const data7 = await res7.json();
    assert(res7.status === 403, `Status code is 403 Forbidden (Got: ${res7.status})`);
    assert(data7.success === false, `Response success is false`);
    assert(
      data7.message.toLowerCase().includes("unauthorized") ||
      data7.message.toLowerCase().includes("permission"),
      `Blocked message: '${data7.message}'`
    );

    // =========================================================================
    // 8. Cancel order successfully
    // =========================================================================
    console.log("\n>>> Test 8: Cancel order successfully");
    const res8 = await fetch(`${BASE_URL}/${createdOrderId}/cancel`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        cancellation_reason: "Ordered by mistake, want another model",
      }),
    });
    const data8 = await res8.json();
    assert(res8.status === 200, `Status code is 200 (Got: ${res8.status})`);
    assert(data8.success === true, `Response success is true`);
    assert(
      data8.data?.order?.order_status === "CANCELLED",
      `Order status is updated to CANCELLED`
    );
    assert(
      data8.data?.order?.cancellation_reason ===
      "Ordered by mistake, want another model",
      `Cancellation reason saved`
    );
    assert(
      !!data8.data?.order?.cancelled_at,
      `cancelled_at timestamp recorded`
    );

    // =========================================================================
    // 9. Cancel without reason should fail
    // =========================================================================
    console.log("\n>>> Test 9: Cancel without reason should fail");
    // Place a second order to test
    const resOrderB = await fetch(`${BASE_URL}/buy-now`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        product_id: testProductId,
        quantity: 1,
        shipping_name: "Kundan Singh",
        shipping_phone: "9876543210",
        shipping_address: "Flat 101",
        shipping_city: "Patna",
        shipping_state: "Bihar",
        shipping_pincode: "800001",
      }),
    });
    const dataOrderB = await resOrderB.json();
    const orderBId = dataOrderB.data?.order?.id;

    const res9 = await fetch(`${BASE_URL}/${orderBId}/cancel`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        cancellation_reason: "   ", // Blank reason
      }),
    });
    const data9 = await res9.json();
    assert(res9.status === 400, `Status code is 400 (Got: ${res9.status})`);
    assert(data9.success === false, `Response success is false`);
    assert(
      data9.message.toLowerCase().includes("reason"),
      `Validation error for reason: '${data9.message}'`
    );

    // =========================================================================
    // 10. Cancel already cancelled order should fail (Prevent double cancellation)
    // =========================================================================
    console.log("\n>>> Test 10: Cancel already cancelled order should fail");
    const res10 = await fetch(`${BASE_URL}/${createdOrderId}/cancel`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        cancellation_reason: "Trying to cancel again",
      }),
    });
    const data10 = await res10.json();
    assert(
      res10.status === 409 || res10.status === 400,
      `Status code is 409/400 (Got: ${res10.status})`
    );
    assert(data10.success === false, `Response success is false`);
    assert(
      data10.message.toLowerCase().includes("already been cancelled"),
      `Double cancellation prevented: '${data10.message}'`
    );

    // =========================================================================
    // 11. Cancel shipped order should fail
    // =========================================================================
    console.log("\n>>> Test 11: Cancel shipped order should fail");
    // Mark orderB as SHIPPED directly in DB to simulate lifecycle transition
    await db.query("UPDATE orders SET order_status = 'SHIPPED' WHERE id = ?", [
      orderBId,
    ]);

    const res11 = await fetch(`${BASE_URL}/${orderBId}/cancel`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        cancellation_reason: "Want to cancel shipped order",
      }),
    });
    const data11 = await res11.json();
    assert(res11.status === 400, `Status code is 400 (Got: ${res11.status})`);
    assert(data11.success === false, `Response success is false`);
    assert(
      data11.message.toLowerCase().includes("shipped") ||
      data11.message.toLowerCase().includes("cannot be cancelled"),
      `Shipped order cancellation rejected: '${data11.message}'`
    );

    // Clean up orderB
    await db.query("DELETE FROM order_items WHERE order_id = ?", [orderBId]);
    await db.query("DELETE FROM orders WHERE id = ?", [orderBId]);

    // =========================================================================
    // 12. Verify stock decreases after order
    // =========================================================================
    console.log("\n>>> Test 12: Verify stock decreases after order");
    const [beforeOrderProd] = await db.query(
      "SELECT stock FROM products WHERE id = ?",
      [testProductId]
    );
    const stockBefore = beforeOrderProd[0].stock;

    const orderQty = 3;
    const res12 = await fetch(`${BASE_URL}/buy-now`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        product_id: testProductId,
        quantity: orderQty,
        shipping_name: "Stock Tester",
        shipping_phone: "9999999999",
        shipping_address: "123 Test Rd",
        shipping_city: "Patna",
        shipping_state: "Bihar",
        shipping_pincode: "800001",
      }),
    });
    const data12 = await res12.json();
    const stockTestOrderId = data12.data?.order?.id;

    const [afterOrderProd] = await db.query(
      "SELECT stock FROM products WHERE id = ?",
      [testProductId]
    );
    const stockAfter = afterOrderProd[0].stock;
    assert(
      stockAfter === stockBefore - orderQty,
      `Stock reduced atomically by ${orderQty}: from ${stockBefore} to ${stockAfter}`
    );

    // =========================================================================
    // 13. Verify stock restores after cancellation
    // =========================================================================
    console.log("\n>>> Test 13: Verify stock restores after cancellation");
    await fetch(`${BASE_URL}/${stockTestOrderId}/cancel`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        cancellation_reason: "Testing stock restoration",
      }),
    });

    const [afterCancelProd] = await db.query(
      "SELECT stock FROM products WHERE id = ?",
      [testProductId]
    );
    const stockAfterCancel = afterCancelProd[0].stock;
    assert(
      stockAfterCancel === stockBefore,
      `Stock restored back by ${orderQty}: from ${stockAfter} back to ${stockAfterCancel}`
    );

    // Clean up test order
    await db.query("DELETE FROM order_items WHERE order_id = ?", [
      stockTestOrderId,
    ]);
    await db.query("DELETE FROM orders WHERE id = ?", [stockTestOrderId]);

    // =========================================================================
    // 14. Verify failed transaction does not create partial order
    // =========================================================================
    console.log(
      "\n>>> Test 14: Verify failed transaction does not create partial order"
    );
    const [orderCountBefore] = await db.query(
      "SELECT COUNT(*) as count FROM orders"
    );
    const [itemCountBefore] = await db.query(
      "SELECT COUNT(*) as count FROM order_items"
    );

    // Trigger an intentional failure by ordering far more than available stock
    await fetch(`${BASE_URL}/buy-now`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        product_id: testProductId,
        quantity: 999999,
        shipping_name: "Rollback Tester",
        shipping_phone: "9999999999",
        shipping_address: "123 Fail Rd",
        shipping_city: "Patna",
        shipping_state: "Bihar",
        shipping_pincode: "800001",
      }),
    });

    const [orderCountAfter] = await db.query(
      "SELECT COUNT(*) as count FROM orders"
    );
    const [itemCountAfter] = await db.query(
      "SELECT COUNT(*) as count FROM order_items"
    );

    assert(
      orderCountBefore[0].count === orderCountAfter[0].count,
      `No orphan record added to orders table (Count before: ${orderCountBefore[0].count}, count after: ${orderCountAfter[0].count})`
    );
    assert(
      itemCountBefore[0].count === itemCountAfter[0].count,
      `No orphan record added to order_items table (Count before: ${itemCountBefore[0].count}, count after: ${itemCountAfter[0].count})`
    );

    // Clean up initial test order
    if (createdOrderId) {
      await db.query("DELETE FROM order_items WHERE order_id = ?", [
        createdOrderId,
      ]);
      await db.query("DELETE FROM orders WHERE id = ?", [createdOrderId]);
    }

    // Reset stock to initial stock just in case
    await db.query("UPDATE products SET stock = ? WHERE id = ?", [
      initialStock,
      testProductId,
    ]);
    console.log(`Stock restored to original value (${initialStock}).`);

    // =========================================================================
    // SUMMARY
    // =========================================================================
    console.log("\n============================================================");
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("============================================================\n");

    if (failed === 0) {
      console.log("ALL 14 TESTS COMPLETED SUCCESSFULLY! \u2705");
    } else {
      console.error("SOME TESTS FAILED! \u274C");
    }
  } catch (err) {
    console.error("Test Suite Unhandled Error:", err);
  } finally {
    if (server) {
      server.close();
    }
    process.exit(failed === 0 ? 0 : 1);
  }
}

runTests();
