require("dotenv").config();

const API_URL = process.env.API_URL || "http://localhost:5000";

// --------------------------------------------------
// CONFIGURATION
// --------------------------------------------------

const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;

const TOTAL_ORDERS = 10;
const DELAY_BETWEEN_ORDERS = 200;

// --------------------------------------------------
// LOGIN AND GET JWT TOKEN
// --------------------------------------------------

async function login() {
  console.log("Logging in...");

  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Login failed");
  }

  console.log(`Logged in as: ${data.user.name} (${data.user.role})`);

  return data.token;
}

// --------------------------------------------------
// CREATE ONE SIMULATED ORDER
// --------------------------------------------------

async function createOrder(token, orderNumber) {
  const order = {
    customer_name: `Load Test Customer ${orderNumber}`,
    address: `Test Address ${orderNumber}, Hyderabad`,
    items: [
      {
        name: "Test Product",
        quantity: 1,
        price: 100,
      },
    ],
    total_amount: 100,
  };

  const response = await fetch(`${API_URL}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(order),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `Failed to create order ${orderNumber}`);
  }

  return data.order;
}

// --------------------------------------------------
// HELPER: WAIT
// --------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --------------------------------------------------
// RUN LOAD TEST
// --------------------------------------------------

async function runLoadTest() {
  console.log("\n🚀 Starting load test...");
  console.log(`API: ${API_URL}`);
  console.log(`Target orders: ${TOTAL_ORDERS}`);
  console.log(`Delay between orders: ${DELAY_BETWEEN_ORDERS}ms\n`);

  let successCount = 0;
  let failureCount = 0;

  const startTime = Date.now();

  try {
    if (!EMAIL || !PASSWORD) {
      throw new Error(
        "Missing TEST_EMAIL or TEST_PASSWORD in the load-test .env file",
      );
    }

    const token = await login();

    for (let i = 1; i <= TOTAL_ORDERS; i++) {
      try {
        const createdOrder = await createOrder(token, i);

        successCount++;

        console.log(
          `✓ Order ${i}/${TOTAL_ORDERS} created — ID: ${createdOrder.id}`,
        );
      } catch (error) {
        failureCount++;

        console.error(`✗ Order ${i}/${TOTAL_ORDERS} failed: ${error.message}`);
      }

      // Don't wait after the final order
      if (i < TOTAL_ORDERS) {
        await sleep(DELAY_BETWEEN_ORDERS);
      }
    }
  } catch (error) {
    console.error("\n❌ Load test could not start:", error.message);
    return;
  }

  const totalTimeMs = Date.now() - startTime;

  console.log("\n-------------------------------");
  console.log("📊 LOAD TEST RESULTS");
  console.log("-------------------------------");
  console.log(`Total attempted: ${TOTAL_ORDERS}`);
  console.log(`Successful:      ${successCount}`);
  console.log(`Failed:          ${failureCount}`);
  console.log(`Total time:      ${(totalTimeMs / 1000).toFixed(2)} seconds`);
  console.log("-------------------------------\n");
}

runLoadTest();
