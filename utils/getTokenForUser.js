require("dotenv").config();
const generateToken = require("./generateToken");

const userId = process.argv[2] || 1;
const token = generateToken(parseInt(userId, 10));

console.log(`\n=== JWT Token for User ID ${userId} ===`);
console.log(`Bearer ${token}\n`);
