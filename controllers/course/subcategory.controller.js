import Subcategory from "../../models/Subcategory.js";

export const createSubcategory = async (req, res) => {
  try {
    const { category_id, subcategory_name } = req.body;
    const subcategory = new Subcategory({
      category_id,
      subcategory_name,
    });
    // console.log(subcategory, "subcategory");
    await subcategory.save();
    res.status(201).json({ success: true, data: subcategory });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const getSubcategories = async (req, res) => {
  try {
    const subcategories = await Subcategory.find().populate("category_id");
    res.status(200).json({ success: true, data: subcategories });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getSubcategoriesByCategory = async (req, res) => {
  try {
    console.log(req.params.categoryId, "categoryId");
    const subcategories = await Subcategory.find({
      category_id: req.params.categoryId,
    });
    // console.log(subcategories, "subcategories by category");
    res.status(200).json({ success: true, data: subcategories });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
