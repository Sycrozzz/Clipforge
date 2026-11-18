import SettingsForm from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-sm text-zinc-400">
        ClipForge uses an AI provider to turn speech into text (with word timing for subtitles) and to pick the best moments. Video
        processing itself happens on this computer.
      </p>
      <SettingsForm />
    </div>
  );
}
