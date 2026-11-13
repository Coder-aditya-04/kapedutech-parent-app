import type { Prisma } from "@prisma/client";

// Shape returned by the admin attendance list routes (today / date / batch).
// Only the fields the admin attendance, dashboard and analytics pages read are
// selected, so we don't ship qrCode, userId, parent contact details etc. for
// every row from Neon.
export const attendanceListSelect = {
  id: true,
  studentId: true,
  date: true,
  type: true,
  markedAt: true,
  student: {
    select: {
      id: true,
      name: true,
      enrollmentNo: true,
      batch: true,
      center: true,
    },
  },
} satisfies Prisma.AttendanceSelect;
