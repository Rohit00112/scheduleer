import { redirect } from "next/navigation";

export default function LegacyConflictsRedirect() {
  redirect("/admin/conflicts");
}
