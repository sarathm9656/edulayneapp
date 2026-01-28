import Category from "../../models/Category.js";

// Create a new category
export const createCategory = async (req, res) => {
  console.log(req.body, "req.body inside the createCategory");
  const { category } = req.body;
  try {
    const existingCategory = await Category.findOne({ category });
    if (existingCategory) {
      return res
        .status(400)
        .json({ success: false, error: "Category already exists" });
    }

    const newCategory = new Category({ category });
    await newCategory.save();
    res.status(201).json({ success: true, data: newCategory });
  } catch (error) {
    console.log(error, "error inside the createCategory");
    res.status(400).json({ success: false, error: error.message });
  }
};

// Get all categories
export const getCategories = async (req, res) => {
  // console.log("getCategories");
  try {
    const categories = await Category.find();
    // console.log(categories);
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    res.status(200).json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.status(200).json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
