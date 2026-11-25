import Link from "next/link";
import { requireWorker } from "@/lib/session";
import { ProfileForm } from "./profile-form";
import { PhotoUpload } from "./photo-upload";

export default async function WorkerProfilePage() {
  const { supabase, userId, worker } = await requireWorker();
  const [{ data: categories }, { data: zips }] = await Promise.all([
    supabase.from("categories").select("key, label").eq("active", true).order("sort_order"),
    supabase.from("service_zips").select("zip, town").eq("active", true).order("zip"),
  ]);

  let photoUrl: string | null = null;
  if (worker?.photo_path) {
    const { data } = await supabase.storage.from("worker-photos").createSignedUrl(worker.photo_path, 600);
    photoUrl = data?.signedUrl ?? null;
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/worker" className="text-sm text-stone-600 underline">← Back</Link>
        <h1 className="mt-2 text-2xl font-semibold">Your helper profile</h1>
        <p className="text-sm text-stone-600">Posters see your first name, photo, job types, general area, rate and rating. Never your address.</p>
      </div>
      <ProfileForm
        categories={categories ?? []}
        zips={zips ?? []}
        initial={{
          bio: worker?.bio ?? "",
          categories: worker?.categories ?? [],
          service_zips: worker?.service_zips ?? (zips?.length === 1 ? [zips[0].zip] : []),
          typical_rate: worker?.typical_rate_cents ? String(worker.typical_rate_cents / 100) : "",
          social_url: worker?.social_url ?? "",
        }}
      />
      <section id="photo" className="space-y-3">
        <h2 className="text-lg font-semibold">Photo</h2>
        {worker ? (
          <PhotoUpload userId={userId} currentUrl={photoUrl} />
        ) : (
          <p className="text-sm text-stone-600">Save your profile details first, then add a photo.</p>
        )}
      </section>
    </div>
  );
}
