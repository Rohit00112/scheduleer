import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export enum UserRole {
  ADMIN = "admin",
  USER = "user",
  INSTRUCTOR = "instructor",
}

@Entity("schedules")
export class Schedule {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar" })
  day!: string;

  @Column({ type: "varchar" })
  startTime!: string;

  @Column({ type: "varchar" })
  endTime!: string;

  @Column({ type: "varchar" })
  classType!: string;

  @Column({ type: "integer" })
  year!: number;

  @Column({ type: "varchar" })
  moduleCode!: string;

  @Column({ type: "varchar" })
  moduleTitle!: string;

  @Column({ type: "varchar" })
  instructor!: string;

  @Column({ type: "varchar" })
  group!: string;

  @Column({ type: "varchar" })
  block!: string;

  @Column({ type: "integer" })
  level!: number;

  @Column({ type: "varchar" })
  room!: string;

  @Column({ type: "varchar" })
  program!: string;

  @Column({ type: "varchar" })
  section!: string;

  @Column({ type: "float", nullable: true, default: 1.5 })
  hours!: number | null;

  @Column({ type: "varchar", nullable: true })
  specialization!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", unique: true })
  username!: string;

  @Column({ type: "varchar" })
  password!: string;

  @Column({ type: "varchar", default: UserRole.USER })
  role!: UserRole;

  @Column({ type: "boolean", default: false })
  mustChangePassword!: boolean;

  @Column({ type: "varchar", nullable: true })
  instructorName!: string | null;
}

@Entity("audit_logs")
export class AuditLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar" })
  action!: string;

  @Column({ type: "varchar" })
  entityType!: string;

  @Column({ type: "integer", nullable: true })
  entityId!: number | null;

  @Column({ type: "varchar" })
  username!: string;

  @Column({ type: "text", nullable: true })
  oldValues!: string | null;

  @Column({ type: "text", nullable: true })
  newValues!: string | null;

  @Column({ type: "varchar", nullable: true })
  description!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}

@Entity("announcements")
export class Announcement {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar" })
  title!: string;

  @Column({ type: "text" })
  message!: string;

  @Column({ type: "varchar", default: "info" })
  type!: string;

  @Column({ type: "varchar" })
  createdBy!: string;

  @Column({ type: "boolean", default: true })
  active!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}

@Entity("rooms")
export class Room {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", unique: true })
  name!: string;

  @Column({ type: "integer", nullable: true })
  capacity!: number | null;

  @Column({ type: "varchar", default: "" })
  block!: string;

  @Column({ type: "varchar", default: "" })
  level!: string;

  @Column({ type: "varchar", nullable: true })
  furnitureType!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity("module_catalog")
export class ModuleCatalog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", unique: true })
  code!: string;

  @Column({ type: "varchar" })
  title!: string;

  @CreateDateColumn()
  createdAt!: Date;
}

@Entity("teacher_assignments")
export class TeacherAssignment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar" })
  moduleCode!: string;

  @Column({ type: "varchar", nullable: true })
  classType!: string | null;

  @Column({ type: "varchar" })
  teacher!: string;

  @Column({ type: "varchar", nullable: true })
  block!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}

@Entity("telegram_preferences")
export class TelegramPreference {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", unique: true })
  telegramUserId!: string;

  @Column({ type: "varchar", nullable: true })
  instructor!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

export const entities = [
  Schedule,
  User,
  AuditLog,
  Announcement,
  Room,
  ModuleCatalog,
  TeacherAssignment,
  TelegramPreference,
];
