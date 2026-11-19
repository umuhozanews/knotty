import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const key = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ error: "Payment gateway not configured" }, { status: 503 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing transaction id" }, { status: 400 });

  const res = await fetch(`https://api.flutterwave.com/v3/transactions/${id}/verify`, {
    headers: { Authorization: `Bearer ${key}` },
  });

  const data = await res.json();

  return NextResponse.json({
    status: data.data?.status ?? "pending",
    amount: data.data?.amount,
    flw_ref: data.data?.flw_ref,
  });
}
