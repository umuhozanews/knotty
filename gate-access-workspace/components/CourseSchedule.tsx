"use client";
import { MoreHorizontal, Clock, Video } from "lucide-react";

const days = [
  { day: 22, dow: "Sep" },
  { day: 23, dow: "Sep", today: true },
  { day: 24, dow: "Sep" },
  { day: 25, dow: "Sep" },
  { day: 26, dow: "Sep" },
  { day: 27, dow: "Sep" },
  { day: 28, dow: "Sep" },
  { day: 29, dow: "Sep" },
  { day: 30, dow: "Sep" },
  { day: 1, dow: "Oct" },
];

const schedule = [
  {
    name: "Britt Gamble",
    role: "Sr. UI/UX designer",
    avatar: "bg-purple-400",
  },
  {
    name: "Steven Williamson",
    role: "Project Manager",
    avatar: "bg-blue-400",
  },
  {
    name: "Conrad Glass",
    role: "Course Mentor",
    avatar: "bg-teal-400",
  },
];

export default function CourseSchedule() {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-800">Course Schedule</h3>
          <p className="text-xs text-gray-400 mt-0.5">{"Here's your schedule activity for today"}</p>
        </div>
        <button className="text-gray-400 hover:text-gray-600">
          <MoreHorizontal size={18} />
        </button>
      </div>

      {/* Calendar strip */}
      <div className="grid grid-cols-5 gap-1.5 mb-4">
        {days.map((d) => (
          <button
            key={`${d.day}-${d.dow}`}
            className={`flex flex-col items-center py-2 rounded-xl text-xs transition ${
              d.today
                ? "bg-blue-600 text-white"
                : "hover:bg-gray-50 text-gray-600"
            }`}
          >
            <span className="font-semibold text-sm">{d.day}</span>
            <span className={d.today ? "text-orange-100" : "text-gray-400"}>{d.dow}</span>
          </button>
        ))}
      </div>

      {/* Schedule list */}
      <div className="space-y-3">
        {schedule.map((s) => (
          <div key={s.name} className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-full ${s.avatar} flex-shrink-0 flex items-center justify-center text-white text-xs font-bold`}
            >
              {s.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
              <p className="text-xs text-gray-400 truncate">{s.role}</p>
            </div>
            <div className="flex gap-1.5">
              <button className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200 transition">
                <Clock size={13} className="text-gray-500" />
              </button>
              <button className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200 transition">
                <Video size={13} className="text-gray-500" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
