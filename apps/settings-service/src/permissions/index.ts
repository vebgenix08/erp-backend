export const settingsPermissions = {
  institution: {
    read: "settings.institution.read",
    update: "settings.institution.update",
  },
  campuses: {
    read: "settings.campuses.read",
    create: "settings.campuses.create",
    update: "settings.campuses.update",
    deactivate: "settings.campuses.deactivate",
  },
  academicYears: {
    read: "settings.academicYears.read",
    create: "settings.academicYears.create",
    update: "settings.academicYears.update",
    activate: "settings.academicYears.activate",
  },
} as const;

export type SettingsPermission =
  (typeof settingsPermissions.institution)[keyof typeof settingsPermissions.institution]
  | (typeof settingsPermissions.campuses)[keyof typeof settingsPermissions.campuses]
  | (typeof settingsPermissions.academicYears)[keyof typeof settingsPermissions.academicYears];
