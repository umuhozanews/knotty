import StudentDetailClient from "./StudentDetailClient";

export function generateStaticParams() {
  return [
    { id: "std-1" }, { id: "std-2" }, { id: "std-3" },
    { id: "std-4" }, { id: "std-5" }, { id: "std-6" },
    { id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }, { id: "5" }, { id: "6" },
  ];
}

export default function Page() {
  return <StudentDetailClient />;
}
