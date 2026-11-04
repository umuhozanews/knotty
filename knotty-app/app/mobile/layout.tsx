export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: "100dvh" }}
    >
      {children}
    </div>
  );
}
