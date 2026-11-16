import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Package, Pencil, Plus, UtensilsCrossed, X } from 'lucide-react-native';
import { Colors } from '../constants/theme';
import { FilterPills } from '../components/FilterPills';
import { SearchInput } from '../components/SearchInput';
import { useAuth } from '../context/AuthContext';
import {
  CANTEEN_CATEGORIES,
  CanteenProduct,
  formatRwf,
  listAllCanteenProducts,
  toggleProductActive,
  upsertCanteenProduct,
} from '../lib/canteen';

type ProductForm = {
  id?: string;
  name: string;
  price: string;
  category: string;
  stock_qty: string;
};

const emptyForm = (): ProductForm => ({ name: '', price: '', category: 'Other', stock_qty: '' });

export default function CanteenProductsScreen() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const [products, setProducts] = useState<CanteenProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ProductForm>(emptyForm());
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listAllCanteenProducts(schoolId);
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products.');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { void loadProducts(); }, [loadProducts]);

  const categories = [
    { id: 'All', label: 'All' },
    ...CANTEEN_CATEGORIES.filter((c) => c !== 'All').map((c) => ({ id: c, label: c })),
  ];

  const filtered = products.filter((p) => {
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch = !search.trim() || p.name.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const openAddForm = () => {
    setForm(emptyForm());
    setFormError(null);
    setFormOpen(true);
  };

  const openEditForm = (p: CanteenProduct) => {
    setForm({
      id: p.id,
      name: p.name,
      price: String(p.price),
      category: p.category,
      stock_qty: p.stock_qty !== null ? String(p.stock_qty) : '',
    });
    setFormError(null);
    setFormOpen(true);
  };

  const handleSave = async () => {
    const name = form.name.trim();
    const price = parseFloat(form.price);
    if (!name) { setFormError('Product name is required.'); return; }
    if (!form.price || isNaN(price) || price < 0) { setFormError('Enter a valid price.'); return; }
    const stockQty = form.stock_qty.trim() ? parseInt(form.stock_qty, 10) : null;
    if (form.stock_qty.trim() && (isNaN(stockQty!) || stockQty! < 0)) {
      setFormError('Stock quantity must be a non-negative number, or leave blank for unlimited.');
      return;
    }

    setFormSaving(true);
    setFormError(null);
    try {
      const saved = await upsertCanteenProduct(schoolId, {
        ...(form.id ? { id: form.id } : {}),
        name,
        price,
        category: form.category,
        stock_qty: stockQty,
        is_active: true,
      });
      setFormOpen(false);
      setProducts((prev) => {
        if (form.id) return prev.map((p) => (p.id === saved.id ? saved : p));
        return [saved, ...prev];
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setFormSaving(false);
    }
  };

  const handleToggleActive = async (product: CanteenProduct) => {
    const next = !product.is_active;
    try {
      await toggleProductActive(product.id, next);
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, is_active: next } : p)));
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not update product.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <ArrowLeft size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Products</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openAddForm} activeOpacity={0.85}>
            <Plus size={18} color={Colors.textWhite} />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
        <SearchInput value={search} onChangeText={setSearch} placeholder="Search products" />
        <FilterPills items={categories} selectedId={selectedCategory} onSelect={setSelectedCategory} />
      </View>

      {loading ? (
        <View style={styles.centeredState}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centeredState}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadProducts} activeOpacity={0.8}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centeredState}>
          <Package size={40} color={Colors.textSecondary} strokeWidth={1.5} />
          <Text style={styles.emptyText}>
            {products.length === 0 ? 'No products yet. Tap Add to create one.' : 'No products match your search.'}
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {filtered.map((p) => (
            <View key={p.id} style={[styles.productRow, !p.is_active && styles.productRowInactive]}>
              <View style={styles.productIconBox}>
                <UtensilsCrossed size={22} color={p.is_active ? Colors.primary : Colors.textTertiary} strokeWidth={1.5} />
              </View>
              <View style={styles.productInfo}>
                <Text style={[styles.productName, !p.is_active && styles.productNameInactive]}>{p.name}</Text>
                <View style={styles.productMeta}>
                  <Text style={styles.productPrice}>{formatRwf(p.price)}</Text>
                  <Text style={styles.productCategory}>{p.category}</Text>
                  {p.stock_qty !== null && (
                    <Text style={[styles.productStock, p.stock_qty <= 0 && styles.productStockEmpty]}>
                      Stock: {p.stock_qty}
                    </Text>
                  )}
                </View>
              </View>
              <TouchableOpacity style={styles.editBtn} onPress={() => openEditForm(p)} activeOpacity={0.7}>
                <Pencil size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
              <Switch
                value={p.is_active}
                onValueChange={() => handleToggleActive(p)}
                trackColor={{ false: Colors.borderInput, true: Colors.primaryLight }}
                thumbColor={p.is_active ? Colors.primary : Colors.textTertiary}
              />
            </View>
          ))}
        </ScrollView>
      )}

      {/* Add / Edit Product Modal */}
      <Modal visible={formOpen} transparent animationType="slide" onRequestClose={() => setFormOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setFormOpen(false)}>
          <View style={styles.sheetBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.sheetContainer}>
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>{form.id ? 'Edit Product' : 'Add Product'}</Text>
                  <TouchableOpacity onPress={() => setFormOpen(false)} style={styles.sheetCloseBtn} activeOpacity={0.7}>
                    <X size={20} color={Colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Product name *</Text>
                    <TextInput
                      style={styles.formInput}
                      value={form.name}
                      onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                      placeholder="e.g. Mineral water 500ml"
                      placeholderTextColor={Colors.textTertiary}
                    />
                  </View>

                  <View style={styles.formRow}>
                    <View style={[styles.formGroup, { flex: 1 }]}>
                      <Text style={styles.formLabel}>Price (RWF) *</Text>
                      <TextInput
                        style={styles.formInput}
                        value={form.price}
                        onChangeText={(v) => setForm((f) => ({ ...f, price: v.replace(/[^0-9.]/g, '') }))}
                        placeholder="0"
                        placeholderTextColor={Colors.textTertiary}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={[styles.formGroup, { flex: 1 }]}>
                      <Text style={styles.formLabel}>Stock qty</Text>
                      <TextInput
                        style={styles.formInput}
                        value={form.stock_qty}
                        onChangeText={(v) => setForm((f) => ({ ...f, stock_qty: v.replace(/[^0-9]/g, '') }))}
                        placeholder="Unlimited"
                        placeholderTextColor={Colors.textTertiary}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Category</Text>
                    <View style={styles.categoryPicker}>
                      {CANTEEN_CATEGORIES.filter((c) => c !== 'All').map((c) => (
                        <TouchableOpacity
                          key={c}
                          style={[styles.categoryChip, form.category === c && styles.categoryChipActive]}
                          onPress={() => setForm((f) => ({ ...f, category: c }))}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.categoryChipText, form.category === c && styles.categoryChipTextActive]}>
                            {c}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {formError && <Text style={styles.formError}>{formError}</Text>}

                  <TouchableOpacity
                    style={[styles.saveBtn, formSaving && styles.saveBtnLoading]}
                    onPress={handleSave}
                    activeOpacity={0.85}
                    disabled={formSaving}
                  >
                    {formSaving
                      ? <ActivityIndicator size="small" color={Colors.textWhite} />
                      : <Text style={styles.saveBtnText}>{form.id ? 'Save changes' : 'Add product'}</Text>}
                  </TouchableOpacity>
                </ScrollView>
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
  addBtn: {
    minHeight: 38, paddingHorizontal: 14, borderRadius: 10, backgroundColor: Colors.primary,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: Colors.textWhite },

  scrollView: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 16, gap: 10, paddingBottom: 48 },

  productRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 12,
  },
  productRowInactive: { opacity: 0.6 },
  productIconBox: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  productInfo: { flex: 1, gap: 3 },
  productName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  productNameInactive: { color: Colors.textTertiary },
  productMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  productPrice: { fontSize: 13, fontWeight: '700', color: Colors.secondaryGreen },
  productCategory: {
    fontSize: 11, fontWeight: '600', color: Colors.textSecondary,
    backgroundColor: Colors.background, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
  },
  productStock: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  productStockEmpty: { color: Colors.absent },
  editBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },

  centeredState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: Colors.absent, textAlign: 'center' },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 24 },
  retryBtn: { minHeight: 40, paddingHorizontal: 20, borderRadius: 10, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: Colors.primaryDark },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheetContainer: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 34, maxHeight: '90%',
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  sheetCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  formScroll: { maxHeight: 500 },
  formGroup: { gap: 6, marginBottom: 14 },
  formRow: { flexDirection: 'row', gap: 12 },
  formLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  formInput: {
    minHeight: 48, borderWidth: 1.5, borderColor: Colors.borderInput, borderRadius: 12,
    paddingHorizontal: 12, fontSize: 15, fontWeight: '600', color: Colors.textPrimary,
    backgroundColor: Colors.background,
  },
  categoryPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.background,
  },
  categoryChipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  categoryChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  categoryChipTextActive: { color: Colors.primaryDark },
  formError: { fontSize: 13, color: Colors.absent, fontWeight: '600', marginBottom: 10 },
  saveBtn: {
    minHeight: 54, borderRadius: 14, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 4, marginBottom: 8,
  },
  saveBtnLoading: { opacity: 0.7 },
  saveBtnText: { color: Colors.textWhite, fontSize: 16, fontWeight: '700' },
});
