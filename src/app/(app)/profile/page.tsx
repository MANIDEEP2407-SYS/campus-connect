import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";

export default async function MyProfile() {
  const v = await requireViewer();
  redirect(`/profile/${v.profile.handle}`);
}
