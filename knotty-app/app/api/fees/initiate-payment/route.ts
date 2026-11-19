import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const key = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ error: "Payment gateway not configured" }, { status: 503 });
  }

  const { phone, amount, name, network, tx_ref } = await req.json();

  if (!phone || !amount || !network || !tx_ref) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const normalizedPhone = phone.replace(/^0/, "250");

  const res = await fetch(
    "https://api.flutterwave.com/v3/charges?type=mobile_money_rwanda",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        phone_number: normalizedPhone,
        amount,
        currency: "RWF",
        email: "fees@ishurihub.rw",
        tx_ref,
        fullname: name,
        network: network === "AIRTEL" ? "AIRTEL" : "MTN",
      }),
    }
  );

  const data = await res.json();

  if (data.status !== "success") {
    return NextResponse.json(
      { error: data.message || "Failed to initiate payment" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    transaction_id: data.data.id,
    flw_ref: data.data.flw_ref,
    status: data.data.status,
  });
}
