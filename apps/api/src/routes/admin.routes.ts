import { Router } from "express";
import {
  listStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  todayAttendance,
  batchAttendance,
  dateAttendance,
  searchStudents,
  getStudentAttendanceHistory,
  importStudents,
} from "../controllers/admin.controller.js";
import { listBatches, createBatch, deleteBatch, batchAnalytics, batchDetail } from "../controllers/batch.controller.js";
import { uploadResults, listTests, getTestResults } from "../controllers/result.controller.js";
import { requireAdminSecret } from "../middleware/adminAuth.js";

const router = Router();

// All admin routes require the X-Admin-Secret header
router.use(requireAdminSecret);

// Students
router.get("/students/search", searchStudents);
router.get("/students/:studentId/attendance", getStudentAttendanceHistory);
router.get("/students", listStudents);
router.post("/students", createStudent);
router.post("/students/import", importStudents);
router.put("/students/:id", updateStudent);
router.delete("/students/:id", deleteStudent);

// Attendance
router.get("/attendance/today", todayAttendance);
router.get("/attendance/batch", batchAttendance);
router.get("/attendance/date", dateAttendance);

// Batches
router.get("/batches", listBatches);
router.post("/batches", createBatch);
router.delete("/batches/:id", deleteBatch);
router.get("/batches/analytics", batchAnalytics);
router.get("/batches/detail/:name", batchDetail);

// Results
router.post("/results", uploadResults);
router.get("/results/tests", listTests);
router.get("/results/test/:testName", getTestResults);

export default router;
