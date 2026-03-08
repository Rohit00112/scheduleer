import { redirect } from "next/navigation";

export default function LegacyMyScheduleRedirect() {
  redirect("/portal/my-week");
}
