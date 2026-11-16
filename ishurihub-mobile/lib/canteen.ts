import { getSupabaseClient } from './supabase';
import { ApiError } from './api';

export type CardHolder = {
  card_assignment_id: string;
  card_number: string;
  student_id: string;
  legal_name: string;
  class_name: string;
  education_level_name: string;
  admission_number: string;
  profile_photo_path: string | null;
  wallet_balance: number;
  card_status: string;
  is_frozen: boolean;
};

export type CanteenProduct = {
  id: string;
  school_id: string;
  name: string;
  price: number;
  category: string;
  photo_url: string | null;
  stock_qty: number | null;
  is_active: boolean;
};

export type CanteenCartItem = {
  product: CanteenProduct;
  quantity: number;
};

export type PurchaseResult = {
  transaction_id: string;
  new_balance: number;
};

export type TopupResult = {
  request_id: string;
  new_balance?: number;
  channel: 'CASH' | 'MOMO';
};

export type MomoTopupResult = {
  request_id: string;
  payment_ref: string;
  status: 'pending';
  amount: number;
  phone: string;
};

export type CanteenTransaction = {
  id: string;
  student_id: string;
  legal_name: string;
  items: { name: string; price: number; qty: number }[];
  total_amount: number;
  wallet_balance_after: number | null;
  status: string;
  created_at: string;
};

export type TopupRequest = {
  id: string;
  student_id: string;
  legal_name: string;
  amount: number;
  channel: 'CASH' | 'MOMO';
  status: string;
  phone: string | null;
  created_at: string;
  completed_at: string | null;
};

export type SalesSummary = {
  total_sales: number;
  transaction_count: number;
  date: string;
};

function getClient() {
  const client = getSupabaseClient();
  if (!client) throw new ApiError('Supabase is not configured for this build.');
  return client;
}

// ── Card lookup (NFC) ─────────────────────────────────────────────────────────

export async function lookupCardByNfc(schoolId: string, nfcUid: string): Promise<CardHolder> {
  const client = getClient();
  const { data, error } = await client.functions.invoke('lookup-card', {
    body: { school_id: schoolId, nfc_uid: nfcUid.trim().toUpperCase(), identifier_kind: 'nfc_uid' },
  });
  if (error) throw new ApiError(error.message);
  if (data?.error) {
    if (data.error === 'card_not_found') throw new ApiError('No card found for this NFC scan.');
    throw new ApiError(data.error ?? 'Card lookup failed.');
  }
  return data as CardHolder;
}

export async function lookupCardByNumber(schoolId: string, cardNumber: string): Promise<CardHolder> {
  const client = getClient();
  const { data, error } = await client.rpc('lookup_card_holder', {
    p_school_id: schoolId,
    p_card_number: cardNumber.trim().toUpperCase(),
  });
  if (error) throw new ApiError(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new ApiError('No card found with that number.');
  return row as CardHolder;
}

// ── Products ──────────────────────────────────────────────────────────────────

export async function listCanteenProducts(schoolId: string): Promise<CanteenProduct[]> {
  const { data, error } = await getClient()
    .from('canteen_products')
    .select('*')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw new ApiError(error.message);
  return (data ?? []) as CanteenProduct[];
}

export async function listAllCanteenProducts(schoolId: string): Promise<CanteenProduct[]> {
  const { data, error } = await getClient()
    .from('canteen_products')
    .select('*')
    .eq('school_id', schoolId)
    .order('is_active', { ascending: false })
    .order('name', { ascending: true });
  if (error) throw new ApiError(error.message);
  return (data ?? []) as CanteenProduct[];
}

export async function upsertCanteenProduct(
  schoolId: string,
  product: Partial<CanteenProduct> & { name: string; price: number; category: string },
): Promise<CanteenProduct> {
  const payload = { ...product, school_id: schoolId, updated_at: new Date().toISOString() };
  const { data, error } = await getClient()
    .from('canteen_products')
    .upsert(payload)
    .select()
    .single();
  if (error) throw new ApiError(error.message);
  return data as CanteenProduct;
}

export async function toggleProductActive(productId: string, isActive: boolean): Promise<void> {
  const { error } = await getClient()
    .from('canteen_products')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', productId);
  if (error) throw new ApiError(error.message);
}

// ── Purchase ──────────────────────────────────────────────────────────────────

export async function processCanteenPurchase(
  schoolId: string,
  cardAssignmentId: string,
  cart: CanteenCartItem[],
): Promise<PurchaseResult> {
  const items = cart.map((c) => ({
    product_id: c.product.id,
    name: c.product.name,
    price: c.product.price,
    qty: c.quantity,
  }));
  const total = cart.reduce((sum, c) => sum + c.product.price * c.quantity, 0);

  const { data, error } = await getClient().rpc('canteen_purchase', {
    p_school_id: schoolId,
    p_card_assignment_id: cardAssignmentId,
    p_items: JSON.stringify(items),
    p_total: total,
  });
  if (error) throw new ApiError(error.message);
  return data as PurchaseResult;
}

// ── Top-up ────────────────────────────────────────────────────────────────────

export async function cashTopUp(
  schoolId: string,
  cardAssignmentId: string,
  amount: number,
  description = 'Cash top-up',
): Promise<TopupResult> {
  const { data, error } = await getClient().rpc('initiate_cash_topup', {
    p_school_id: schoolId,
    p_card_assignment_id: cardAssignmentId,
    p_amount: amount,
    p_description: description,
  });
  if (error) throw new ApiError(error.message);
  return { ...(data as object), channel: 'CASH' } as TopupResult;
}

export async function momoTopUp(
  schoolId: string,
  cardAssignmentId: string,
  studentId: string,
  amount: number,
  phone: string,
): Promise<MomoTopupResult> {
  const client = getClient();
  const { data, error } = await client.functions.invoke('initiate-topup', {
    body: { school_id: schoolId, card_assignment_id: cardAssignmentId, student_id: studentId, amount, phone },
  });
  if (error) throw new ApiError(error.message);
  if (data?.error) throw new ApiError(data.detail ?? data.error ?? 'MoMo top-up failed.');
  return data as MomoTopupResult;
}

// ── Reports ───────────────────────────────────────────────────────────────────

export async function getCanteenSalesSummary(schoolId: string, date?: string): Promise<SalesSummary> {
  const params: Record<string, unknown> = { p_school_id: schoolId };
  if (date) params.p_date = date;
  const { data, error } = await getClient().rpc('get_canteen_sales_summary', params);
  if (error) throw new ApiError(error.message);
  return data as SalesSummary;
}

export async function listCanteenTransactions(
  schoolId: string,
  limit = 50,
  offset = 0,
): Promise<CanteenTransaction[]> {
  const { data, error } = await getClient().rpc('list_canteen_transactions', {
    p_school_id: schoolId,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw new ApiError(error.message);
  return (data ?? []) as CanteenTransaction[];
}

export async function listTopupRequests(
  schoolId: string,
  limit = 50,
  offset = 0,
): Promise<TopupRequest[]> {
  const { data, error } = await getClient().rpc('list_topup_requests', {
    p_school_id: schoolId,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw new ApiError(error.message);
  return (data ?? []) as TopupRequest[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatRwf(amount: number): string {
  return `${Math.round(amount).toLocaleString('en-RW')} RWF`;
}

export const CANTEEN_CATEGORIES = ['All', 'Snacks', 'Drinks', 'Meals', 'Fruits', 'Bread', 'Other'];
