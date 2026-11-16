import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ArrowLeft,
  CheckCircle,
  CreditCard,
  Minus,
  Plus,
  Radio,
  RotateCcw,
  ShoppingCart,
  UtensilsCrossed,
  Wallet,
  X,
} from 'lucide-react-native';
import { Colors } from '../constants/theme';
import { FilterPills } from '../components/FilterPills';
import { SearchInput } from '../components/SearchInput';
import { useAuth } from '../context/AuthContext';
import {
  CANTEEN_CATEGORIES,
  CanteenCartItem,
  CanteenProduct,
  CardHolder,
  formatRwf,
  listCanteenProducts,
  lookupCardByNumber,
  processCanteenPurchase,
} from '../lib/canteen';

type ScreenState = 'pos' | 'processing' | 'receipt';

type Receipt = {
  transaction_id: string;
  student_name: string;
  total: number;
  new_balance: number;
  items: CanteenCartItem[];
};

export default function CanteenScreen() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const [screenState, setScreenState] = useState<ScreenState>('pos');
  const [products, setProducts] = useState<CanteenProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState<{ [id: string]: number }>({});
  const [orderSheetOpen, setOrderSheetOpen] = useState(false);
  const [scannedCard, setScannedCard] = useState<CardHolder | null>(null);

  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [cardInput, setCardInput] = useState('');
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const cardInputRef = useRef<TextInput>(null);

  const loadProducts = useCallback(async () => {
    if (!schoolId) return;
    setProductsLoading(true);
    setProductsError(null);
    try {
      const data = await listCanteenProducts(schoolId);
      setProducts(data);
    } catch (err) {
      setProductsError(err instanceof Error ? err.message : 'Failed to load products.');
    } finally {
      setProductsLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { void loadProducts(); }, [loadProducts]);

  const categories = [
    { id: 'All', label: 'All' },
    ...CANTEEN_CATEGORIES.filter((c) => c !== 'All').map((c) => ({ id: c, label: c })),
  ];

  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch = !search.trim() || p.name.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleQuantityChange = (id: string, delta: number) => {
    setCart((prev) => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      const updated = { ...prev };
      if (next === 0) delete updated[id]; else updated[id] = next;
      return updated;
    });
  };

  const totalItems = Object.values(cart).reduce((s, n) => s + n, 0);
  const totalAmount = Object.entries(cart).reduce((s, [id, qty]) => {
    const p = products.find((p) => p.id === id);
    return s + (p ? p.price * qty : 0);
  }, 0);

  const cartItems: CanteenCartItem[] = Object.entries(cart)
    .map(([id, quantity]) => {
      const product = products.find((p) => p.id === id);
      return product ? { product, quantity } : null;
    })
    .filter((x): x is CanteenCartItem => x !== null);

  const openScanModal = () => {
    setCardInput('');
    setScanError(null);
    setScanModalOpen(true);
    setTimeout(() => cardInputRef.current?.focus(), 300);
  };

  const handleCardLookup = async (inputValue?: string) => {
    const val = (inputValue ?? cardInput).trim().toUpperCase();
    if (!val) { setScanError('Enter a card number.'); return; }
    setScanLoading(true);
    setScanError(null);
    try {
      const holder = await lookupCardByNumber(schoolId, val);
      setScanModalOpen(false);
      setScannedCard(holder);
      if (holder.is_frozen) {
        Alert.alert('Card Frozen', `${holder.legal_name}'s card is currently suspended. Purchases are blocked.`);
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Card not found.');
    } finally {
      setScanLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!scannedCard) { openScanModal(); return; }
    if (scannedCard.is_frozen) {
      Alert.alert('Card Frozen', 'This card is suspended. Purchases are not allowed.');
      return;
    }
    if (totalAmount > scannedCard.wallet_balance) {
      Alert.alert(
        'Insufficient Balance',
        `Balance is ${formatRwf(scannedCard.wallet_balance)} but order is ${formatRwf(totalAmount)}.`,
      );
      return;
    }

    setOrderSheetOpen(false);
    setScreenState('processing');
    try {
      const result = await processCanteenPurchase(schoolId, scannedCard.card_assignment_id, cartItems);
      setReceipt({
        transaction_id: result.transaction_id,
        student_name: scannedCard.legal_name,
        total: totalAmount,
        new_balance: result.new_balance,
        items: cartItems,
      });
      setCart({});
      setScannedCard((prev) => prev ? { ...prev, wallet_balance: result.new_balance } : prev);
      setScreenState('receipt');
    } catch (err) {
      setScreenState('pos');
      Alert.alert('Payment Failed', err instanceof Error ? err.message : 'Purchase could not be completed.');
    }
  };

  const handleNewOrder = () => {
    setReceipt(null);
    setCart({});
    setScreenState('pos');
  };

  if (screenState === 'processing') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.centeredStateText}>Processing payment...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (screenState === 'receipt' && receipt) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.receiptContainer}>
          <View style={styles.receiptIconCircle}>
            <CheckCircle size={48} color={Colors.primary} />
          </View>
          <Text style={styles.receiptTitle}>Payment Successful</Text>
          <Text style={styles.receiptStudentName}>{receipt.student_name}</Text>

          <View style={styles.receiptCard}>
            {receipt.items.map((item, i) => (
              <View key={item.product.id} style={[styles.receiptRow, i < receipt.items.length - 1 && styles.receiptRowBorder]}>
                <Text style={styles.receiptItemName}>{item.product.name} × {item.quantity}</Text>
                <Text style={styles.receiptItemPrice}>{formatRwf(item.product.price * item.quantity)}</Text>
              </View>
            ))}
            <View style={[styles.receiptRow, styles.receiptRowBorder, styles.receiptTotalRow]}>
              <Text style={styles.receiptTotalLabel}>Total charged</Text>
              <Text style={styles.receiptTotalAmount}>{formatRwf(receipt.total)}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptBalanceLabel}>New wallet balance</Text>
              <Text style={styles.receiptBalanceAmount}>{formatRwf(receipt.new_balance)}</Text>
            </View>
          </View>

          <Text style={styles.receiptRef}>Ref: {receipt.transaction_id.slice(0, 8).toUpperCase()}</Text>

          <TouchableOpacity style={styles.newOrderBtn} onPress={handleNewOrder} activeOpacity={0.85}>
            <RotateCcw size={18} color={Colors.textWhite} />
            <Text style={styles.newOrderBtnText}>New order</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.topupBtn} onPress={() => router.push('/canteen-topup' as never)} activeOpacity={0.8}>
            <Wallet size={16} color={Colors.primaryDark} />
            <Text style={styles.topupBtnText}>Top up wallet</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <ArrowLeft size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Canteen POS</Text>
          <TouchableOpacity style={styles.headerActionBtn} onPress={() => router.push('/canteen-products' as never)} activeOpacity={0.7}>
            <Text style={styles.headerActionText}>Products</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerActionBtn, styles.headerActionBtnPrimary]} onPress={() => router.push('/canteen-topup' as never)} activeOpacity={0.7}>
            <Wallet size={14} color={Colors.textWhite} />
            <Text style={[styles.headerActionText, styles.headerActionTextPrimary]}>Top up</Text>
          </TouchableOpacity>
        </View>

        {scannedCard ? (
          <TouchableOpacity
            style={[styles.studentStrip, scannedCard.is_frozen && styles.studentStripFrozen]}
            onPress={openScanModal}
            activeOpacity={0.8}
          >
            <View style={styles.studentStripLeft}>
              <CreditCard size={18} color={scannedCard.is_frozen ? Colors.absent : Colors.primary} />
              <View>
                <Text style={styles.studentStripName}>{scannedCard.legal_name}</Text>
                <Text style={styles.studentStripClass}>{scannedCard.class_name} · {scannedCard.education_level_name}</Text>
              </View>
            </View>
            <View style={styles.studentStripRight}>
              <Text style={styles.balanceLabel}>Balance</Text>
              <Text style={[styles.balanceAmount, scannedCard.wallet_balance < totalAmount && styles.balanceLow]}>
                {formatRwf(scannedCard.wallet_balance)}
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.scanCardBtn} onPress={openScanModal} activeOpacity={0.85}>
            <Radio size={18} color={Colors.primary} />
            <Text style={styles.scanCardBtnText}>Tap or enter student card to pay</Text>
          </TouchableOpacity>
        )}

        <SearchInput value={search} onChangeText={setSearch} placeholder="Search menu items" />
        <FilterPills items={categories} selectedId={selectedCategory} onSelect={setSelectedCategory} />
      </View>

      {/* Product Grid */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {productsLoading ? (
          <View style={styles.centeredState}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.loadingText}>Loading products...</Text>
          </View>
        ) : productsError ? (
          <View style={styles.centeredState}>
            <Text style={styles.errorText}>{productsError}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadProducts} activeOpacity={0.8}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : filteredProducts.length === 0 ? (
          <View style={styles.centeredState}>
            <UtensilsCrossed size={40} color={Colors.textSecondary} strokeWidth={1.5} />
            <Text style={styles.emptyText}>
              {products.length === 0 ? 'No products yet. Tap Products to add some.' : 'No items match your search.'}
            </Text>
          </View>
        ) : (
          <View style={styles.productGrid}>
            {filteredProducts.map((p) => {
              const count = cart[p.id] || 0;
              const outOfStock = p.stock_qty !== null && p.stock_qty <= 0;
              return (
                <View key={p.id} style={[styles.productCard, outOfStock && styles.productCardDimmed]}>
                  <View style={styles.productImagePlaceholder}>
                    <UtensilsCrossed size={32} color={outOfStock ? Colors.textTertiary : Colors.primary} strokeWidth={1.5} />
                    {outOfStock && (
                      <View style={styles.outOfStockBadge}>
                        <Text style={styles.outOfStockText}>Out</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.productMeta}>
                    <Text style={styles.productName} numberOfLines={2}>{p.name}</Text>
                    <Text style={styles.productPrice}>{formatRwf(p.price)}</Text>
                  </View>
                  {outOfStock ? (
                    <View style={styles.addBtnDisabled}>
                      <Text style={styles.addBtnDisabledText}>Out of stock</Text>
                    </View>
                  ) : count === 0 ? (
                    <TouchableOpacity style={styles.addBtn} onPress={() => handleQuantityChange(p.id, 1)} activeOpacity={0.7}>
                      <Text style={styles.addBtnText}>Add</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.stepper}>
                      <TouchableOpacity style={styles.stepBtn} onPress={() => handleQuantityChange(p.id, -1)} activeOpacity={0.7}>
                        <Minus size={16} color={Colors.textPrimary} />
                      </TouchableOpacity>
                      <Text style={styles.stepCount}>{count}</Text>
                      <TouchableOpacity style={styles.stepBtn} onPress={() => handleQuantityChange(p.id, 1)} activeOpacity={0.7}>
                        <Plus size={16} color={Colors.textPrimary} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Floating Cart Bar */}
      {totalItems > 0 && (
        <View style={styles.cartBar}>
          <TouchableOpacity style={styles.cartBarBtn} onPress={() => setOrderSheetOpen(true)} activeOpacity={0.85}>
            <View style={styles.cartBarLeft}>
              <ShoppingCart size={20} color={Colors.textWhite} />
              <Text style={styles.cartBarCount}>{totalItems} {totalItems === 1 ? 'item' : 'items'}</Text>
            </View>
            <Text style={styles.cartBarRight}>View order · {formatRwf(totalAmount)}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Order Bottom Sheet */}
      <Modal visible={orderSheetOpen} transparent animationType="slide" onRequestClose={() => setOrderSheetOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setOrderSheetOpen(false)}>
          <View style={styles.sheetBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.sheetContainer}>
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>Order ({totalItems} {totalItems === 1 ? 'item' : 'items'})</Text>
                  <TouchableOpacity onPress={() => setOrderSheetOpen(false)} style={styles.sheetCloseBtn} activeOpacity={0.7}>
                    <X size={20} color={Colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.cartItemsScroll}>
                  {cartItems.map(({ product, quantity }) => (
                    <View key={product.id} style={styles.cartItemRow}>
                      <View style={styles.cartItemMeta}>
                        <Text style={styles.cartItemName}>{product.name}</Text>
                        <Text style={styles.cartItemLinePrice}>{formatRwf(product.price * quantity)}</Text>
                      </View>
                      <View style={styles.cartStepper}>
                        <TouchableOpacity style={styles.cartStepBtn} onPress={() => handleQuantityChange(product.id, -1)}>
                          <Minus size={14} color={Colors.textPrimary} />
                        </TouchableOpacity>
                        <Text style={styles.cartStepCount}>{quantity}</Text>
                        <TouchableOpacity style={styles.cartStepBtn} onPress={() => handleQuantityChange(product.id, 1)}>
                          <Plus size={14} color={Colors.textPrimary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </ScrollView>

                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalAmountText}>{formatRwf(totalAmount)}</Text>
                </View>

                {scannedCard && (
                  <View style={[styles.balanceRow, totalAmount > scannedCard.wallet_balance && styles.balanceRowLow]}>
                    <Text style={styles.balanceRowLabel}>{scannedCard.legal_name}'s balance</Text>
                    <Text style={[styles.balanceRowAmount, totalAmount > scannedCard.wallet_balance && styles.balanceRowAmountLow]}>
                      {formatRwf(scannedCard.wallet_balance)}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.payBtn, (!scannedCard || scannedCard.is_frozen) && styles.payBtnSecondary]}
                  onPress={handleCheckout}
                  activeOpacity={0.85}
                >
                  <Radio size={20} color={Colors.textWhite} />
                  <Text style={styles.payBtnText}>
                    {scannedCard
                      ? (scannedCard.is_frozen ? 'Card frozen — cannot pay' : 'Charge card')
                      : 'Scan card to pay'}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Card Scan Modal */}
      <Modal visible={scanModalOpen} transparent animationType="fade" onRequestClose={() => setScanModalOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setScanModalOpen(false)}>
          <View style={styles.scanBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.scanDialog}>
                <View style={styles.scanDialogHeader}>
                  <View style={styles.scanIconCircle}>
                    <Radio size={24} color={Colors.primary} />
                  </View>
                  <TouchableOpacity onPress={() => setScanModalOpen(false)} style={styles.scanCloseBtn}>
                    <X size={20} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.scanTitle}>Student Card</Text>
                <Text style={styles.scanSubtitle}>
                  Enter the card number, or use NFC to scan the student's card.
                </Text>

                <TextInput
                  ref={cardInputRef}
                  style={styles.cardNumberInput}
                  value={cardInput}
                  onChangeText={(v) => { setCardInput(v.toUpperCase()); setScanError(null); }}
                  placeholder="Card number (e.g. ISH-001-S-0001)"
                  placeholderTextColor={Colors.textTertiary}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="search"
                  onSubmitEditing={() => handleCardLookup()}
                />

                {scanError && <Text style={styles.scanError}>{scanError}</Text>}

                <TouchableOpacity
                  style={[styles.lookupBtn, scanLoading && styles.lookupBtnLoading]}
                  onPress={() => handleCardLookup()}
                  activeOpacity={0.85}
                  disabled={scanLoading}
                >
                  {scanLoading ? (
                    <ActivityIndicator size="small" color={Colors.textWhite} />
                  ) : (
                    <>
                      <CreditCard size={18} color={Colors.textWhite} />
                      <Text style={styles.lookupBtnText}>Look up card</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, backgroundColor: Colors.surface, gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: -8 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 20, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.4 },
  headerActionBtn: {
    minHeight: 36, paddingHorizontal: 10, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4,
  },
  headerActionBtnPrimary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  headerActionText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  headerActionTextPrimary: { color: Colors.textWhite },

  studentStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.primaryLight, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.primary,
  },
  studentStripFrozen: { backgroundColor: Colors.absentBg, borderColor: Colors.absent },
  studentStripLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  studentStripName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  studentStripClass: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  studentStripRight: { alignItems: 'flex-end', gap: 1 },
  balanceLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  balanceAmount: { fontSize: 15, fontWeight: '800', color: Colors.secondaryGreen },
  balanceLow: { color: Colors.absent },

  scanCardBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.background,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed',
  },
  scanCardBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },

  scrollView: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 16, paddingBottom: 90 },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  productCard: {
    width: '48.5%', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 16, padding: 8, gap: 8,
  },
  productCardDimmed: { opacity: 0.55 },
  productImagePlaceholder: {
    width: '100%', height: 100, borderRadius: 11, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  outOfStockBadge: {
    position: 'absolute', bottom: 6, backgroundColor: Colors.absentBg,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  outOfStockText: { fontSize: 10, fontWeight: '700', color: Colors.absent },
  productMeta: { paddingHorizontal: 4, gap: 1, minHeight: 44 },
  productName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, lineHeight: 18 },
  productPrice: { fontSize: 13, fontWeight: '700', color: Colors.secondaryGreen },
  addBtn: { minHeight: 40, borderRadius: 10, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { fontSize: 14, fontWeight: '700', color: Colors.primaryDark },
  addBtnDisabled: { minHeight: 40, borderRadius: 10, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  addBtnDisabledText: { fontSize: 12, fontWeight: '600', color: Colors.textTertiary },
  stepper: {
    minHeight: 40, borderRadius: 10, backgroundColor: Colors.surfaceMuted,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6,
  },
  stepBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  stepCount: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },

  centeredState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  centeredStateText: { fontSize: 16, fontWeight: '600', color: Colors.textSecondary },
  loadingText: { fontSize: 14, color: Colors.textSecondary },
  errorText: { fontSize: 14, color: Colors.absent, textAlign: 'center' },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 24 },
  retryBtn: {
    minHeight: 40, paddingHorizontal: 20, borderRadius: 10, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: Colors.primaryDark },

  cartBar: { position: 'absolute', bottom: 16, left: 16, right: 16 },
  cartBarBtn: {
    minHeight: 56, borderRadius: 16, backgroundColor: Colors.primaryDark,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18,
    shadowColor: '#14532D', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  cartBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cartBarCount: { fontSize: 15, fontWeight: '700', color: Colors.textWhite },
  cartBarRight: { fontSize: 15, fontWeight: '700', color: Colors.textWhite },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheetContainer: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 34, gap: 14, maxHeight: '82%',
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  sheetCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  cartItemsScroll: { maxHeight: 220 },
  cartItemRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderDivider,
  },
  cartItemMeta: { flex: 1, gap: 2 },
  cartItemName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  cartItemLinePrice: { fontSize: 13, fontWeight: '600', color: Colors.secondaryGreen },
  cartStepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cartStepBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  cartStepCount: { fontSize: 14, fontWeight: '700', minWidth: 16, textAlign: 'center' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 },
  totalLabel: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  totalAmountText: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  balanceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.primaryLight, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  balanceRowLow: { backgroundColor: Colors.absentBg },
  balanceRowLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  balanceRowAmount: { fontSize: 15, fontWeight: '800', color: Colors.secondaryGreen },
  balanceRowAmountLow: { color: Colors.absent },
  payBtn: {
    minHeight: 54, borderRadius: 14, backgroundColor: Colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  payBtnSecondary: { backgroundColor: Colors.textSecondary },
  payBtnText: { color: Colors.textWhite, fontSize: 16, fontWeight: '700' },

  scanBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  scanDialog: { width: '100%', maxWidth: 380, backgroundColor: Colors.surface, borderRadius: 20, padding: 20, gap: 12 },
  scanDialogHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scanIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  scanCloseBtn: { padding: 6 },
  scanTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  scanSubtitle: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  cardNumberInput: {
    minHeight: 50, borderWidth: 1.5, borderColor: Colors.borderInput, borderRadius: 12,
    paddingHorizontal: 14, fontSize: 15, fontWeight: '600', color: Colors.textPrimary,
    backgroundColor: Colors.background, fontFamily: 'monospace',
  },
  scanError: { fontSize: 13, color: Colors.absent, fontWeight: '600' },
  lookupBtn: {
    minHeight: 50, borderRadius: 14, backgroundColor: Colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  lookupBtnLoading: { opacity: 0.7 },
  lookupBtnText: { color: Colors.textWhite, fontSize: 15, fontWeight: '700' },

  receiptContainer: { padding: 24, alignItems: 'center', gap: 14, paddingBottom: 48 },
  receiptIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  receiptTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  receiptStudentName: { fontSize: 16, fontWeight: '600', color: Colors.textSecondary },
  receiptCard: { width: '100%', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, overflow: 'hidden' },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  receiptRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderDivider },
  receiptTotalRow: { backgroundColor: Colors.background },
  receiptItemName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  receiptItemPrice: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  receiptTotalLabel: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  receiptTotalAmount: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  receiptBalanceLabel: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  receiptBalanceAmount: { fontSize: 15, fontWeight: '800', color: Colors.secondaryGreen },
  receiptRef: { fontSize: 11, color: Colors.textTertiary, fontFamily: 'monospace' },
  newOrderBtn: {
    width: '100%', minHeight: 54, borderRadius: 14, backgroundColor: Colors.primaryDark,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  newOrderBtnText: { color: Colors.textWhite, fontSize: 16, fontWeight: '700' },
  topupBtn: {
    width: '100%', minHeight: 48, borderRadius: 12, backgroundColor: Colors.primaryLight,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  topupBtnText: { color: Colors.primaryDark, fontSize: 14, fontWeight: '700' },
});
