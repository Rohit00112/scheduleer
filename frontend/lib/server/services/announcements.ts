import { ApiError } from "../errors";
import type { AnnouncementInput } from "../validation";
import { getRepositories } from "./repositories";

export async function getActiveAnnouncements() {
  const { announcementRepo } = await getRepositories();
  return announcementRepo.find({
    where: { active: true },
    order: { createdAt: "DESC" },
  });
}

export async function getAllAnnouncements() {
  const { announcementRepo } = await getRepositories();
  return announcementRepo.find({ order: { createdAt: "DESC" } });
}

export async function createAnnouncement(input: AnnouncementInput, createdBy: string) {
  const { announcementRepo } = await getRepositories();
  const announcement = announcementRepo.create({
    ...input,
    type: input.type || "info",
    createdBy,
  });

  return announcementRepo.save(announcement);
}

export async function deleteAnnouncement(id: number) {
  const { announcementRepo } = await getRepositories();
  const announcement = await announcementRepo.findOne({ where: { id } });
  if (!announcement) {
    throw new ApiError(404, "Announcement not found");
  }

  await announcementRepo.remove(announcement);
  return { success: true };
}

export async function toggleAnnouncement(id: number) {
  const { announcementRepo } = await getRepositories();
  const announcement = await announcementRepo.findOne({ where: { id } });
  if (!announcement) {
    throw new ApiError(404, "Announcement not found");
  }

  announcement.active = !announcement.active;
  return announcementRepo.save(announcement);
}
