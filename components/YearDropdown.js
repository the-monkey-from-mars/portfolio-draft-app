"use client";
import { useRouter } from "next/navigation";

export default function YearDropdown({ currentYear }) {
  const router = useRouter();
  const availableYears = ["2026-2027", "2027-2028", "2028-2029", "2029-2030"];

  return (
    <select
      value={currentYear}
      onChange={(e) => {
        const newYear = e.target.value;
        router.push(`/?year=${newYear}`);
      }}
      className="ml-4 bg-gray-800 text-yellow-500 border border-gray-600 rounded p-1 text-lg focus:outline-none focus:border-yellow-500 font-bold cursor-pointer transition relative z-20"
    >
      {availableYears.map((year) => (
        <option key={year} value={year}>
          {year}
        </option>
      ))}
    </select>
  );
}
