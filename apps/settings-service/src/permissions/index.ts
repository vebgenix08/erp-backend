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
  academicUnits: {
    read: "settings.academic-units.read",
    create: "settings.academic-units.create",
    update: "settings.academic-units.update",
  },
  academicYears: {
    read: "settings.academicYears.read",
    create: "settings.academicYears.create",
    update: "settings.academicYears.update",
    activate: "settings.academicYears.activate",
  },
  templates: {
    read: "settings.templates.read",
    create: "settings.templates.create",
    update: "settings.templates.update",
    publish: "settings.templates.publish",
    delete: "settings.templates.delete",
  },
  numbering: { read: "settings.numbering.read", manage: "settings.numbering.manage" },
  notifications: { read: "settings.notifications.read", update: "settings.notifications.update" },
} as const;

export type SettingsPermission =
  (typeof settingsPermissions.institution)[keyof typeof settingsPermissions.institution]
  | (typeof settingsPermissions.campuses)[keyof typeof settingsPermissions.campuses]
  | (typeof settingsPermissions.academicUnits)[keyof typeof settingsPermissions.academicUnits]
  | (typeof settingsPermissions.academicYears)[keyof typeof settingsPermissions.academicYears]
  | (typeof settingsPermissions.templates)[keyof typeof settingsPermissions.templates]
  | (typeof settingsPermissions.numbering)[keyof typeof settingsPermissions.numbering]
  | (typeof settingsPermissions.notifications)[keyof typeof settingsPermissions.notifications];
