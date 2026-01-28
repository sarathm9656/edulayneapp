import Lesson_Type from "../../models/Lesson_Type.model.js";
import Lesson from "../../models/Lesson.model.js";
import { uploadToYouTube } from "../../services/youtube.service.js";
import path from "path";
import moment from "moment";

export const createLesson = async (req, res) => {
  console.log("createLesson function called");
  console.log("req.body:", req.body);
  console.log("req.file:", req.file);

  const { module_id } = req.params;

  try {
    let {
      lesson_title,
      lesson_type,
      video_url,
      quiz_id,
      live_session_id,
      lesson_duration,
      is_downloadable,
      is_preview,
      display_order,
      lesson_description,
      upload_to_youtube,
    } = req.body;
    console.log(lesson_type, "lesson_type");
    console.log("&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&");
    console.log(is_downloadable, is_preview);

    console.log("&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&");


    // Normalize checkboxes and optional fields
    // is_downloadable = is_downloadable === "on";
    // is_preview = is_preview === "on";

    quiz_id = quiz_id?.trim() || undefined;
    live_session_id = live_session_id?.trim() || undefined;

    // Validate required Lesson Type
    const lessonType = await Lesson_Type.findOne({ lesson_type });
    if (!lessonType) {
      return res.status(400).json({
        success: false,
        message: "Invalid lesson_type provided. Type not found.",
      });
    }

    const allowedTypes = ["video", "pdf", "quiz", "live", "assignment", "text", "link", "ppt"];
    if (!allowedTypes.includes(lessonType.lesson_type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lesson_type enum value",
      });
    }

    // Type-based conditional validations
    switch (lessonType.lesson_type) {
      case "video":
        if (!video_url && !req.file) {
          return res.status(400).json({
            success: false,
            message: "Video URL or file is required for video lessons",
          });
        }
        break;

      case "pdf":
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: "PDF file is required for PDF lessons",
          });
        }
        break;

      case "quiz":
        if (!quiz_id) {
          return res.status(400).json({
            success: false,
            message: "Quiz ID is required for quiz lessons",
          });
        }
        break;

      case "live":
        if (!live_session_id) {
          return res.status(400).json({
            success: false,
            message: "Live session ID is required for live lessons",
          });
        }
        break;

      case "ppt":
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: "PPT file is required for PPT lessons",
          });
        }
        break;

      case "link":
        if (!video_url || video_url.trim() === "") {
          return res.status(400).json({
            success: false,
            message: "Link URL is required for link lessons",
          });
        }
        break;
    }

    // set  display order to the last lesson display order + 1
    const maxOrderLesson = await Lesson.findOne({ module_id }).sort({
      display_order: -1,
    });

    // Determine the next display_order
    const nextDisplayOrder = maxOrderLesson?.display_order
      ? maxOrderLesson.display_order + 1
      : 1;

    // Build the lesson payload
    const lessonPayload = {
      module_id,
      lesson_title,
      lesson_type_id: lessonType._id,
      video_url,
      file_path: req.file?.path || "",
      quiz_id,
      live_session_id,
      description: lesson_description,
      lesson_duration,
      is_downloadable,
      is_preview,
      display_order: nextDisplayOrder,
    };

    // Handle YouTube upload for video lessons
    if (lessonType.lesson_type === "video" && req.file && upload_to_youtube === "true") {
      try {
        const absolutePath = path.resolve(req.file.path);
        const ytResult = await uploadToYouTube(absolutePath, {
          title: lesson_title || `GoChess Lesson - ${moment().format('MMM Do, YYYY')}`,
          description: lesson_description || 'Course lesson video.',
          privacyStatus: 'unlisted'
        });
        if (ytResult.success) {
          lessonPayload.video_url = ytResult.url;
        }
      } catch (ytError) {
        console.error("YouTube Upload error (non-fatal):", ytError);
      }
    }

    // Create the lesson record
    const newLesson = await Lesson.create(lessonPayload);
    console.log("Lesson created:", newLesson);

    return res.status(201).json({
      success: true,
      message: "Lesson successfully created",
      data: newLesson,
    });
  } catch (error) {
    console.error("Lesson creation failed:", error);

    return res.status(500).json({
      success: false,
      message: "An error occurred while creating the lesson",
      error: error.message,
    });
  }
};

export const getLessons = async (req, res) => {
  // console.log("#################get lessons 125 lessons#################");
  try {
    const { module_id } = req.params;
    console.log("module_id", module_id);
    const filter = {};
    if (module_id) {
      filter.module_id = module_id;
    }

    // Fetch lessons with populated lesson type
    const lessons = await Lesson.find(filter)
      .populate({
        path: "lesson_type_id",
        model: "Lesson_Type",
        select: "lesson_type", // this will give you text like 'video', 'pdf', etc.
      })
      .populate({
        path: "quiz_id",
        model: "Quiz",
        select:
          "title description pass_percentage time_limit_minutes attempts_allowed",
      })
      // .populate({
      //   path: "live_session_id",
      //   model: "Live_session",
      //   select: "live_session_title",
      // })
      .sort({ display_order: 1 });

    // order the lessons with display order = 0
    // 1. Fetch lessons with display_order === 0 sorted by createdAt
    const unorderedLessons = await Lesson.find({
      display_order: 0,
      module_id: module_id,
    });

    // 2. Update each lesson with a sequential display_order
    for (let i = 0; i < unorderedLessons.length; i++) {
      unorderedLessons[i].display_order = i + 1; // or offset + i + 1 if you need to continue from a max order
      await unorderedLessons[i].save(); // persist the update
    }
    // organize lessons into single keyvalue pairs

    console.log(lessons, "lessons==========================================");
    // Return empty array instead of 404 when no lessons found
    return res.status(200).json({
      success: true,
      data: lessons || [],
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateLessonOrders = async (req, res) => {
  console.log("updateLessonOrders function called");
  try {
    const { lessons } = req.body;
    console.log("lessons", lessons);
    if (!Array.isArray(lessons) || lessons.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Lessons array is required",
      });
    }

    const bulkOps = lessons.map((lesson) => ({
      updateOne: {
        filter: { _id: lesson._id },
        update: { display_order: lesson.display_order },
      },
    }));

    const result = await Lesson.bulkWrite(bulkOps);

    return res.status(200).json({
      success: true,
      message: "Lesson display_order updated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Bulk update error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const editLesson = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      lesson_title,
      lesson_type,
      video_url,
      quiz_id,
      live_session_id,
      lesson_duration,
      is_downloadable,
      is_preview,
      display_order,
      lesson_description,
    } = req.body;

    // First check if lesson exists
    const existingLesson = await Lesson.findById(id);
    if (!existingLesson) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
    }

    const lesson = await Lesson.findByIdAndUpdate(
      id,
      {
        lesson_title,
        lesson_type,
        video_url,
        quiz_id,
        live_session_id,
        lesson_duration,
        is_downloadable,
        is_preview,
        display_order,
        lesson_description,
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Lesson updated successfully",
      data: lesson,
    });
  } catch (error) {
    console.error("Edit lesson error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const fetchLessonsNamesAssociatedWithModule = async (req, res) => {
  try {
    const { module_id } = req.params;
    const lessons = await Lesson.find({ module_id });
    // pass id along
    const lessonsNames = lessons.map((lesson) => {
      return {
        id: lesson._id,
        lesson_title: lesson.lesson_title,
      };
    });

    console.log(lessonsNames, "lessonsNames");
    return res.status(200).json({
      success: true,
      data: lessonsNames,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getLessonContent = async (req, res) => {
  try {
    const { lesson_id } = req.params;
    const lesson = await Lesson.findById(lesson_id).populate({
      path: "lesson_type_id",
      model: "Lesson_Type",
      select: "lesson_type",
    });
    // console.log(lesson, "lesson details");

    const organizedLesson = {
      lesson_type: lesson.lesson_type_id.lesson_type,
      lesson_title: lesson.lesson_title,
      lesson_description: lesson.description,
      lesson_duration: lesson.lesson_duration,
      is_downloadable: lesson.is_downloadable,
      is_preview: lesson.is_preview,
      display_order: lesson.display_order,
      lesson_type_id: lesson.lesson_type_id,
      lesson_id: lesson._id,
      video_url: lesson.video_url,
    };

    return res.status(200).json({
      success: true,
      data: organizedLesson,
    });
  } catch (error) {
    console.error("Get lesson content error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteLesson = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if lesson exists
    const lesson = await Lesson.findById(id);
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
    }

    // Delete the lesson
    await Lesson.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Lesson deleted successfully",
    });
  } catch (error) {
    console.error("Delete lesson error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
