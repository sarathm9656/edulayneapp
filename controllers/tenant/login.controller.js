import Tenant from "../../models/tenant.model.js";

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import Login from "../../models/login.model.js";

export const loginTenant = async (req, res) => {
  console.log("loginTenant", req.body);
  try {
    const { email, password } = req.body;
    console.log(email, password);
    const user = await Login.findOne({ email }).populate("role_id");
    if (!user) {
      return res.status(404).json({ message: "Tenant not found" });
    }
    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    console.log("tenant", user);
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role_id.name,
        role_id: user.role_id._id,
        tenant_id: user.tenant_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        name: user.user_id.fname + " " + user.user_id.lname,
        email: user.email,
        role: user.role_id.name,
        role_id: user.role_id._id,
        tenant_id: user.tenant_id,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message,
    });
  }
};
