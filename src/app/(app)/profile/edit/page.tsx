import type { Metadata } from "next";
import { requireViewer } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ProfileForm } from "@/components/profile/profile-form";

export const metadata: Metadata = { title: "Edit profile" };

export default async function EditProfilePage() {
  const v = await requireViewer();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Edit profile & privacy" back={{ href: `/profile/${v.profile.handle}`, label: "Back to profile" }} />
      <Card>
        <CardContent className="pt-2">
          <ProfileForm profile={v.profile} mode="edit" />
        </CardContent>
      </Card>
    </div>
  );
}
