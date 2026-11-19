import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const key = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ error: "Payment gateway not configured" }, { status: 503 });
  }

  const params = new URL(req.url).searchParams;
  const id = params.get("id");
  const tx_ref = params.get("tx_ref");

  if (!id && !tx_ref) return NextResponse.json({ error: "Missing id or tx_ref" }, { status: 400 });

  let res: Response;
  if (id) {
    res = await fetch(`https://api.flutterwave.com/v3/transactions/${id}/verify`, {
      headers: { Authorization: `Bearer ${key}` },
    });
  } else {
    res = await fetch(`https://api.flutterwave.com/v3/transactions?tx_ref=${tx_ref}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
  }

  const data = await res.json();

  // List endpoint returns data as array
  const record = Array.isArray(data.data) ? data.data[0] : data.data;

  return NextResponse.json({
    status: record?.status ?? "pending",
    amount: record?.amount,
    flw_ref: record?.flw_ref,
    id: record?.id,
  });
}
