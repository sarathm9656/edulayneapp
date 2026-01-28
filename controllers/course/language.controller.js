import Language from "../../models/Language.js";

export const createLanguage = async (req, res) => {
  try {
    const language = new Language(req.body);
    await language.save();
    res.status(201).json({ success: true, data: language });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const getLanguages = async (req, res) => {
  try {
    const languages = await Language.find();
    res.status(200).json({ success: true, data: languages });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateLanguage = async (req, res) => {
  try {
    const language = await Language.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.status(200).json({ success: true, data: language });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const deleteLanguage = async (req, res) => {
  try {
    await Language.findByIdAndDelete(req.params.id);
    res
      .status(200)
      .json({ success: true, message: "Language deleted successfully" });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};
