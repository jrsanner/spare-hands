const MESSAGES: Record<string, string> = {
  not_signed_in: "Your session ended. Please sign in again.",
  not_onboarded: "Finish setting up your account first.",
  suspended: "This account is suspended. Contact support.",
  not_a_worker: "Turn on \"Earn money helping\" for your account first.",
  no_categories: "Pick at least one kind of job.",
  invalid_category: "That kind of job isn't offered yet.",
  no_service_zips: "Pick at least one area you'll work in.",
  outside_service_area: "Spare Hands is only in Greensburg (15601) for now.",
  bio_too_long: "Keep your intro under 500 characters.",
  invalid_rate: "Typical rate must be between $5 and $300.",
  invalid_social_url: "Social links must start with https://",
  invalid_photo_path: "That photo couldn't be saved. Try uploading again.",
  profile_missing: "Save your profile details first.",
  invalid_slots: "Check your time blocks: each needs a day, a start and an end after the start.",
  overlapping_slots: "Two of your time blocks overlap on the same day.",
  too_many_slots: "That's too many time blocks. Combine some.",
  profile_incomplete: "Finish your profile (photo, job types, area and weekly hours) before going available.",
};

export function workerErrorMessage(dbMessage: string | undefined): string {
  return (dbMessage && MESSAGES[dbMessage]) || "Something went wrong. Please try again.";
}
