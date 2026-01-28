import CourseLevel from "../../models/CourseLevel.js";

export const createLevel = async (req, res) => {
  try {
    const courseLevel = new CourseLevel(req.body);
    await courseLevel.save();
    res.status(201).json({ success: true, data: courseLevel });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const getLevels = async (req, res) => {
  try {
    const levels = await CourseLevel.find();
    //  console.log(levels, "levels================================");
    res.status(200).json({ success: true, data: levels });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateLevel = async (req, res) => {
  try {
    const level = await CourseLevel.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.status(200).json({ success: true, data: level });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const deleteLevel = async (req, res) => {
  try {
    await CourseLevel.findByIdAndDelete(req.params.id);
    res
      .status(200)
      .json({ success: true, message: "Level deleted successfully" });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};
