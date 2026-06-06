"use client";
import { Clock, Calendar, Video } from "lucide-react";

export default function UpcomingCourse() {
  return (
    <div className="rounded-2xl p-5 bg-gradient-to-br from-[#2e4a3e] via-[#3a6b4a] to-[#5a8c5a] text-white shadow-sm relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full" />
      <div className="absolute bottom-4 right-8 w-16 h-16 bg-white/5 rounded-full" />

      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm text-green-200">Upcoming Course</h3>
          <button className="text-xs bg-white/20 hover:bg-white/30 transition rounded-xl px-3 py-1 font-medium">
            Learn more
          </button>
        </div>
        <h2 className="text-xl font-bold mb-2">KNOTTY Orientation</h2>
        <p className="text-xs text-green-100/80 mb-4 leading-relaxed">
          Introduction to the KNOTTY Smart Card system — attendance, fees, and canteen management for all students.
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="flex items-center gap-1.5 bg-white/15 rounded-xl px-3 py-1.5 text-xs">
            <Clock size={12} />
            10AM - 12PM
          </span>
          <span className="flex items-center gap-1.5 bg-white/15 rounded-xl px-3 py-1.5 text-xs">
            <Calendar size={12} />
            16th Jun
          </span>
          <span className="flex items-center gap-1.5 bg-white/15 rounded-xl px-3 py-1.5 text-xs">
            <Video size={12} />
            Zoom Link
          </span>
        </div>
      </div>
    </div>
  );
}
