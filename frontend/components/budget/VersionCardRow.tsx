"use client";
import { useRouter } from "next/navigation";
import { BudgetVersionSummary } from "@/lib/api";
import VersionCard from "./VersionCard";

interface Props {
  versions: BudgetVersionSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onNewVersion: () => void;
}

export default function VersionCardRow({
  versions,
  selectedId,
  onSelect,
  onDuplicate,
  onDelete,
  onRename,
  onNewVersion,
}: Props) {
  const baseline = versions.find((v) => v.is_baseline) ?? null;
  const router = useRouter();

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {versions.map((v) => (
        <VersionCard
          key={v.id}
          version={v}
          baseline={baseline}
          isSelected={v.id === selectedId}
          onSelect={() => onSelect(v.id)}
          onDuplicate={() => onDuplicate(v.id)}
          onDelete={() => onDelete(v.id)}
          onRename={(name) => onRename(v.id, name)}
        />
      ))}

      {/* New version menu */}
      <div className="relative group">
        <button
          onClick={onNewVersion}
          className="min-w-[120px] h-full border border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-400 text-2xl font-light"
        >
          +
        </button>
      </div>

      {/* Import button (separate) */}
      <button
        onClick={() => router.push("/budget/import")}
        className="min-w-[140px] border border-dashed border-indigo-200 rounded-xl bg-indigo-50 hover:bg-indigo-100 flex flex-col items-center justify-center gap-1 text-indigo-500 px-3 py-4 text-xs font-medium"
      >
        <span className="text-lg">⬆</span>
        Import Excel
      </button>
    </div>
  );
}
