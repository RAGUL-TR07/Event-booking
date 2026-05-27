const express = require("express");
const { login, register } = require("../controllers/authController");

const router = express.Router();

router.post("/login", login);
router.post("/register", register); // Admin/seeding use

module.exports = router;
