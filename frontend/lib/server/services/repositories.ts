import { getDataSource } from "../db";
import {
  Announcement,
  AuditLog,
  ModuleCatalog,
  Room,
  Schedule,
  TeacherAssignment,
  TelegramPreference,
  User,
} from "../entities";

export async function getRepositories() {
  const dataSource = await getDataSource();

  return {
    announcementRepo: dataSource.getRepository(Announcement),
    auditRepo: dataSource.getRepository(AuditLog),
    moduleRepo: dataSource.getRepository(ModuleCatalog),
    roomRepo: dataSource.getRepository(Room),
    scheduleRepo: dataSource.getRepository(Schedule),
    assignmentRepo: dataSource.getRepository(TeacherAssignment),
    telegramPreferenceRepo: dataSource.getRepository(TelegramPreference),
    userRepo: dataSource.getRepository(User),
  };
}
