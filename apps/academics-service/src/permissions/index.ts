export const academicsPermissions = {
  programs: {
    read: "academics.programs.read",
    create: "academics.programs.create",
    update: "academics.programs.update",
    deactivate: "academics.programs.deactivate",
  },
  classes: {
    read: "academics.classes.read",
    create: "academics.classes.create",
    update: "academics.classes.update",
    deactivate: "academics.classes.deactivate",
  },
  sections: {
    read: "academics.sections.read",
    create: "academics.sections.create",
    update: "academics.sections.update",
    deactivate: "academics.sections.deactivate",
  },
  subjects: {
    read: "academics.subjects.read",
    create: "academics.subjects.create",
    update: "academics.subjects.update",
    deactivate: "academics.subjects.deactivate",
  },
  students: {
    read: "academics.student.read",
    create: "academics.student.create",
    update: "academics.student.update",
    enroll: "academics.enrollment.create",
  },
  teachingAssignments: {
    read: "academics.teaching-assignment.read",
    manage: "academics.teaching-assignment.manage",
  },
  studentDocuments: {
    read: "academics.student-document.read",
    issue: "academics.student-document.issue",
    revoke: "academics.student-document.revoke",
  },
  studentNotes: {
    read: "academics.student-note.read",
    create: "academics.student-note.create",
    update: "academics.student-note.update",
  },
} as const;
