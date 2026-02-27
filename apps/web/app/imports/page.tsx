import { redirect } from "next/navigation";

export default function LegacyImportsRedirect() {
  redirect("/admin/imports");
}
