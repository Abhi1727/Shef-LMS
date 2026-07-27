# LMS Architecture & Fixes

## Architecture Overview

- **Super Admin** → AdminDashboard: Manage students, batches, videos, courses, teachers, mentors.
- **Teachers** → TeacherDashboard: View batches, upload content, add students to batches.
- **Students** → Dashboard: View classroom videos (only when assigned to a batch).

### Data Model

| Entity   | Key Fields                                                    |
|----------|---------------------------------------------------------------|
| **User** | `role` (admin/teacher/student), `course`, `batchId`, `status` |
| **Batch**| `name`, `course`, `teacherId`, `students[]`                   |
| **Classroom** | `title`, `courseId`, `course`, `batchId`, `courseType`  |
| **Course**   | `title` (e.g. "Data Science & AI", "Cyber Security & Ethical Hacking") |

### Expected Flow

1. **Add student globally** (Admin → Students): Create with course; optionally assign batch.
2. **Create batch** (Admin → Batches): Name, course, teacher. Batch starts with no students and no videos.
3. **Assign students to batch** (BatchDetailsPage → Students): Add students; their `User.batchId` and `User.course` are updated.
4. **Assign videos to batch** (BatchDetailsPage → Videos): Add new video with `batchId` and `courseId`, or edit existing video to set `batchId`.
5. **Student login**:
   - **Course only, no batch**: Student can log in, sees **no videos**.
   - **Course + batch**: Student sees videos for their batch and course.

---

## Fixes Applied

### 1. Batch delete cascade

**Issue:** Deleting a batch left orphaned data:
- `User.batchId` still pointed to the deleted batch.
- `Classroom.batchId` still pointed to the deleted batch.

**Fix:** When deleting a batch, we now:
- Clear `User.batchId` for all users in that batch.
- Clear `Classroom.batchId` for all videos assigned to that batch.
- Then delete the batch.

### 2. Video course matching for dashboard

**Issue:** Dashboard filters videos using `video.courseId || video.course` vs `user.course`. If the frontend sent `courseId` as the Course Mongo ID, or `courseType` as "Cyber Security", matching failed.

**Fix:**
- When saving/updating a Classroom video, resolve the course name via `resolveCourseNameForVideo()` (lookup by ObjectId if needed) and store it in `course`.
- Dashboard now also treats `courseType` and partial matches (e.g. `user.course` includes `video.courseType`) so older data continues to work.

### 3. Batch model schedule field

**Issue:** `schedule` was passed when creating batches but was not defined in the Batch schema.

**Fix:** Added `schedule: { type: Mixed }` to the Batch model for `{ days, time }` (or similar).

### 4. Assign video to batch

**Issue:** Only `DELETE /api/batches/:batchId/videos/:videoId` existed to remove a video from a batch; there was no way to assign an existing video to a batch via the batches API.

**Fix:** Added `PUT /api/batches/:batchId/videos/:videoId` to set `video.batchId` (and `video.course` if needed).

### 5. Batch `students` ref

**Issue:** Batch schema used `ref: 'Student'` while students are stored as Users.

**Fix:** Updated `ref` to `'User'`.

---

## API Reference (Batch-related)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/batches` | List all batches |
| GET | `/api/admin/batches/:courseId` | List batches by course name |
| POST | `/api/admin/batches` | Create batch |
| PUT | `/api/admin/batches/:id` | Update batch |
| PUT | `/api/admin/batches/:id/schedule` | Update batch schedule |
| DELETE | `/api/admin/batches/:id` | Delete batch (with cascade) |
| PUT | `/api/batches/:id/students` | Add students to batch |
| DELETE | `/api/batches/:batchId/students/:studentId` | Remove student from batch |
| PUT | `/api/batches/:batchId/videos/:videoId` | Assign video to batch |
| DELETE | `/api/batches/:batchId/videos/:videoId` | Remove video from batch |

---

## Course Naming

Use these exact strings for consistency:

- **Data Science & AI**
- **Cyber Security & Ethical Hacking**

Batches use `course` as a string; Classroom videos use `course` and `courseId`. When adding videos, the backend normalizes `courseId` to the course title when it is a Course ObjectId.
