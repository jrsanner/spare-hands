const MESSAGES: Record<string, string> = {
  not_signed_in: "Your session ended. Please sign in again.",
  suspended: "This account is suspended. Contact support.",
  invalid_name: "Enter your name.",
  invalid_dob: "Enter a real date of birth.",
  under_18: "Spare Hands is for people 18 and older.",
  adult_not_confirmed: "Please confirm you are 18 or older.",
  outside_service_area: "Spare Hands is only in Greensburg (15601) for now. We'll open more areas soon.",
  invalid_roles: "Choose at least one: get help, or earn money.",
  profile_missing: "Something went wrong setting up your account. Try signing in again.",
};

export function onboardingErrorMessage(dbMessage: string | undefined): string {
  return (dbMessage && MESSAGES[dbMessage]) || "Something went wrong. Please try again.";
}
