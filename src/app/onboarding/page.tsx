import { OnboardingFlow } from "./onboarding-flow";

// Open to guests on purpose, and deliberately absent from the middleware
// matcher: the whole point is that someone can find out their level before being
// asked for an account. The result is held in localStorage until they log in.
export const metadata = {
  title: "Level check",
};

export default function OnboardingPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-16">
      <OnboardingFlow />
    </main>
  );
}
