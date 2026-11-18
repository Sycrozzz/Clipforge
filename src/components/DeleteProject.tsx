"use client";

import { useRouter } from "next/navigation";

export default function DeleteProject({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <button
      title="Delete project"
      className="rounded-lg px-2 py-1 text-xs text-zinc-500 transition hover:bg-red-500/10 hover:text-red-300"
      onClick={async (e) => {
        e.preventDefault();
        if (!confirm(`Delete "${name}" and all of its clips? Your original video file is not touched if you imported it by path.`)) return;
        await fetch(`/api/projects/${id}`, { method: "DELETE" });
        router.refresh();
      }}
    >
      Delete
    </button>
  );
}
