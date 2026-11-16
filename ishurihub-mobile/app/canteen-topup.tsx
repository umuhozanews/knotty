import React, { useRef, useState } from 'react';
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
  Banknote,
  CheckCircle,
  CreditCard,
  Radio,
  Smartphone,
  Wallet,
  X,
} from 'lucide-react-native';
import { Colors } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import {
  CardHolder,
  cashTopUp,
  formatRwf,
  lookupCardByNumber,
  momoTopUp,
} from '../lib/canteen';

type Channel = 'CASH' | 'MOMO';

type TopupState =
  | { step: 'card' }
  | { step: 'amount'; card: CardHolder }
  | { step: 'processing'; card: CardHolder; amount: number; channel: Channel }
  | { step: 'pending_momo'; card: CardHolder; amount: number; phone: string; paymentRef: string }
  | { step: 'done'; card: CardHolder; channel: Channel; amount: number; newBalance?: number };

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];

export default function CanteenTopupScreen() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const [state, setState] = useState<TopupState>({ step: 'card' });

  const [cardInput, setCardInput] = useState('');
  const [cardLookupLoading, setCardLookupLoading] = useState(false);
  const [cardLookupError, setCardLookupError] = useState<string | null>(null);

  const [channel, setChannel] = useState<Channel>('CASH');
  const [amountText, setAmountText] = useState('');
  const [phone, setPhone] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);

  const cardInputRef = useRef<TextInput>(null);

  const handleCardLookup = async () => {
    const val = cardInput.trim().toUpperCase();
    if (!val) { setCardLookupError('Enter a card number.'); return; }
    setCardLookupLoading(true);
    setCardLookupError(null);
    try {
      const holder = await lookupCardByNumber(schoolId, val);
      setState({ step: 'amount', card: holder });
    } catch (err) {
      setCardLookupError(err instanceof Error ? err.message : 'Card not found.');
    } finally {
      setCardLookupLoading(false);
    }
  };

  const handleProceedToTopup = async () => {
    if (state.step !== 'amount') return;
    const amount = parseFloat(amountText.replace(/,/g, ''));
    if (!amount || amount <= 0) { setAmountError('Enter a valid amount.'); return; }
    if (amount > 500000) { setAmountError('Maximum top-up is 500,000 RWF.'); return; }
    if (amount < 100) { setAmountError('Minimum top-up is 100 RWF.'); return; }

    if (channel === 'MOMO') {
      const cleanPhone = phone.replace(/\s+/g, '');
      if (!/^(\+?25)?(078|079|072|073)\d{7}$/.test(cleanPhone)) {
        setAmountError('Enter a valid Rwanda MoMo number (07X XXXX XXX).');
        return;
      }
    }

    setAmountError(null);
    setState({ step: 'processing', card: state.card, amount, channel });

    try {
      if (channel === 'CASH') {
        const result = await cashTopUp(schoolId, state.card.card_assignment_id, amount);
        setState({ step: 'done', card: state.card, channel: 'CASH', amount, newBalance: result.new_balance });
      } else {
        const cleanPhone = phone.replace(/\s+/g, '');
        const result = await momoTopUp(
          schoolId,
          state.card.card_assignment_id,
          state.card.student_id,
          amount,
          cleanPhone,
        );
        setState({ step: 'pending_momo', card: state.card, amount, phone: cleanPhone, paymentRef: result.payment_ref });
      }
    } catch (err) {
      setState({ step: 'amount', card: state.card });
      Alert.alert('Top-up Failed', err instanceof Error ? err.message : 'Could not complete top-up.');
    }
  };

  const handleReset = () => {
    setState({ step: 'card' });
    setCardInput('');
    setAmountText('');
    setPhone('');
    setAmountError(null);
    setCardLookupError(null);
  };

  // ── Step: Card lookup ────────────────────────────────────────────────────────
  if (state.step === 'card') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <ArrowLeft size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Top Up Wallet</Text>
        </View>

        <ScrollView contentContainerStyle={styles.stepContent}>
          <View style={styles.stepCard}>
            <View style={styles.stepIconCircle}>
              <CreditCard size={28} color={Colors.primary} />
            </View>
            <Text style={styles.stepCardTitle}>Find Student Card</Text>
            <Text style={styles.stepCardSubtitle}>
              Enter the card number printed on the student's physical card.
            </Text>

            <TextInput
              ref={cardInputRef}
              style={styles.inputField}
              value={cardInput}
              onChangeText={(v) => { setCardInput(v.toUpperCase()); setCardLookupError(null); }}
              placeholder="Card number (e.g. ISH-001-S-0001)"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={handleCardLookup}
            />

            {cardLookupError && <Text style={styles.fieldError}>{cardLookupError}</Text>}

            <TouchableOpacity
              style={[styles.primaryBtn, cardLookupLoading && styles.primaryBtnLoading]}
              onPress={handleCardLookup}
              activeOpacity={0.85}
              disabled={cardLookupLoading}
            >
              {cardLookupLoading
                ? <ActivityIndicator size="small" color={Colors.textWhite} />
                : <Text style={styles.primaryBtnText}>Find card</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Step: Amount & channel ───────────────────────────────────────────────────
  if (state.step === 'amount') {
    const { card } = state;
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={handleReset} activeOpacity={0.7}>
            <ArrowLeft size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Top Up Wallet</Text>
        </View>

        <ScrollView contentContainerStyle={styles.stepContent}>
          {/* Student card info */}
          <View style={styles.studentBanner}>
            <Wallet size={20} color={Colors.primary} />
            <View style={styles.studentBannerInfo}>
              <Text style={styles.studentBannerName}>{card.legal_name}</Text>
              <Text style={styles.studentBannerClass}>{card.class_name} · {card.education_level_name}</Text>
            </View>
            <View style={styles.studentBannerBalance}>
              <Text style={styles.studentBannerBalanceLabel}>Current balance</Text>
              <Text style={styles.studentBannerBalanceAmount}>{formatRwf(card.wallet_balance)}</Text>
            </View>
          </View>

          {/* Payment channel selector */}
          <View style={styles.channelRow}>
            <TouchableOpacity
              style={[styles.channelBtn, channel === 'CASH' && styles.channelBtnActive]}
              onPress={() => { setChannel('CASH'); setAmountError(null); }}
              activeOpacity={0.8}
            >
              <Banknote size={20} color={channel === 'CASH' ? Colors.primary : Colors.textSecondary} />
              <Text style={[styles.channelBtnText, channel === 'CASH' && styles.channelBtnTextActive]}>Cash</Text>
              <Text style={styles.channelBtnDesc}>Instant credit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.channelBtn, channel === 'MOMO' && styles.channelBtnActive]}
              onPress={() => { setChannel('MOMO'); setAmountError(null); }}
              activeOpacity={0.8}
            >
              <Smartphone size={20} color={channel === 'MOMO' ? Colors.primary : Colors.textSecondary} />
              <Text style={[styles.channelBtnText, channel === 'MOMO' && styles.channelBtnTextActive]}>MoMo</Text>
              <Text style={styles.channelBtnDesc}>MTN / Airtel</Text>
            </TouchableOpacity>
          </View>

          {/* Amount input */}
          <View style={styles.amountSection}>
            <Text style={styles.sectionLabel}>Amount (RWF)</Text>
            <View style={styles.amountInputRow}>
              <TextInput
                style={styles.amountInput}
                value={amountText}
                onChangeText={(v) => { setAmountText(v.replace(/[^0-9]/g, '')); setAmountError(null); }}
                placeholder="0"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="numeric"
                returnKeyType="done"
              />
              <Text style={styles.amountCurrency}>RWF</Text>
            </View>
            <View style={styles.quickAmounts}>
              {QUICK_AMOUNTS.map((a) => (
                <TouchableOpacity
                  key={a}
                  style={[styles.quickAmountBtn, amountText === String(a) && styles.quickAmountBtnActive]}
                  onPress={() => { setAmountText(String(a)); setAmountError(null); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.quickAmountText, amountText === String(a) && styles.quickAmountTextActive]}>
                    {a >= 1000 ? `${a / 1000}k` : String(a)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* MoMo phone number */}
          {channel === 'MOMO' && (
            <View style={styles.phoneSection}>
              <Text style={styles.sectionLabel}>Parent / Guardian phone number</Text>
              <TextInput
                style={styles.inputField}
                value={phone}
                onChangeText={(v) => { setPhone(v); setAmountError(null); }}
                placeholder="078 XXX XXXX"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="phone-pad"
                returnKeyType="done"
              />
              <Text style={styles.fieldHint}>They will receive a MoMo payment request on their phone.</Text>
            </View>
          )}

          {amountError && <Text style={styles.fieldError}>{amountError}</Text>}

          <TouchableOpacity style={styles.primaryBtn} onPress={handleProceedToTopup} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>
              {channel === 'CASH' ? 'Top up with cash' : 'Send MoMo request'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Step: Processing ─────────────────────────────────────────────────────────
  if (state.step === 'processing') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.centeredStateText}>
            {state.channel === 'CASH' ? 'Crediting wallet...' : 'Sending MoMo request...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Step: MoMo pending ───────────────────────────────────────────────────────
  if (state.step === 'pending_momo') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.stepContent}>
          <View style={styles.pendingIconCircle}>
            <Smartphone size={44} color={Colors.primary} />
          </View>
          <Text style={styles.doneTitle}>MoMo Request Sent</Text>
          <Text style={styles.doneSubtitle}>
            A payment request of {formatRwf(state.amount)} has been sent to {state.phone}.
          </Text>

          <View style={styles.pendingInfoCard}>
            <View style={styles.pendingInfoRow}>
              <Text style={styles.pendingInfoLabel}>Student</Text>
              <Text style={styles.pendingInfoValue}>{state.card.legal_name}</Text>
            </View>
            <View style={styles.pendingInfoRow}>
              <Text style={styles.pendingInfoLabel}>Amount</Text>
              <Text style={styles.pendingInfoValue}>{formatRwf(state.amount)}</Text>
            </View>
            <View style={styles.pendingInfoRow}>
              <Text style={styles.pendingInfoLabel}>Phone</Text>
              <Text style={styles.pendingInfoValue}>{state.phone}</Text>
            </View>
            <View style={styles.pendingInfoRow}>
              <Text style={styles.pendingInfoLabel}>Ref</Text>
              <Text style={[styles.pendingInfoValue, { fontFamily: 'monospace', fontSize: 11 }]}>
                {state.paymentRef}
              </Text>
            </View>
          </View>

          <View style={styles.pendingNote}>
            <Text style={styles.pendingNoteText}>
              The wallet will be credited automatically once the parent approves the MoMo request on their phone.
            </Text>
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleReset} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Top up another card</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={styles.secondaryBtnText}>Back to canteen</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Step: Done (cash) ────────────────────────────────────────────────────────
  if (state.step === 'done') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.stepContent}>
          <View style={styles.doneIconCircle}>
            <CheckCircle size={44} color={Colors.primary} />
          </View>
          <Text style={styles.doneTitle}>Top Up Successful</Text>
          <Text style={styles.doneSubtitle}>{state.card.legal_name}'s wallet has been credited.</Text>

          <View style={styles.doneSummaryCard}>
            <View style={styles.doneSummaryRow}>
              <Text style={styles.doneSummaryLabel}>Amount added</Text>
              <Text style={styles.doneSummaryValue}>{formatRwf(state.amount)}</Text>
            </View>
            {state.newBalance !== undefined && (
              <View style={styles.doneSummaryRow}>
                <Text style={styles.doneSummaryLabel}>New balance</Text>
                <Text style={[styles.doneSummaryValue, styles.doneSummaryBalanceValue]}>
                  {formatRwf(state.newBalance)}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleReset} activeOpacity={0.85}>
            <Radio size={18} color={Colors.textWhite} />
            <Text style={styles.primaryBtnText}>Top up another card</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={styles.secondaryBtnText}>Back to canteen</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 4,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.4 },

  stepContent: { padding: 20, gap: 16, paddingBottom: 48 },

  stepCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 20, padding: 20, gap: 14, alignItems: 'center',
  },
  stepIconCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  stepCardTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  stepCardSubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  inputField: {
    width: '100%', minHeight: 50, borderWidth: 1.5, borderColor: Colors.borderInput, borderRadius: 12,
    paddingHorizontal: 14, fontSize: 15, fontWeight: '600', color: Colors.textPrimary,
    backgroundColor: Colors.background, fontFamily: 'monospace',
  },
  fieldError: { fontSize: 13, color: Colors.absent, fontWeight: '600', alignSelf: 'flex-start' },
  fieldHint: { fontSize: 12, color: Colors.textSecondary, lineHeight: 16 },

  primaryBtn: {
    width: '100%', minHeight: 54, borderRadius: 14, backgroundColor: Colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  primaryBtnLoading: { opacity: 0.7 },
  primaryBtnText: { color: Colors.textWhite, fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    width: '100%', minHeight: 48, borderRadius: 12, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryBtnText: { color: Colors.primaryDark, fontSize: 15, fontWeight: '700' },

  studentBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.primaryLight,
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.primary,
  },
  studentBannerInfo: { flex: 1, gap: 2 },
  studentBannerName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  studentBannerClass: { fontSize: 12, color: Colors.textSecondary },
  studentBannerBalance: { alignItems: 'flex-end', gap: 1 },
  studentBannerBalanceLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  studentBannerBalanceAmount: { fontSize: 15, fontWeight: '800', color: Colors.secondaryGreen },

  channelRow: { flexDirection: 'row', gap: 12 },
  channelBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 10, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background, gap: 4,
  },
  channelBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  channelBtnText: { fontSize: 15, fontWeight: '700', color: Colors.textSecondary },
  channelBtnTextActive: { color: Colors.primary },
  channelBtnDesc: { fontSize: 11, color: Colors.textTertiary },

  amountSection: { gap: 10 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  amountInputRow: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: Colors.borderInput,
    borderRadius: 12, backgroundColor: Colors.background, paddingHorizontal: 14, minHeight: 56,
  },
  amountInput: { flex: 1, fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
  amountCurrency: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  quickAmounts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickAmountBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.background,
  },
  quickAmountBtnActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  quickAmountText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  quickAmountTextActive: { color: Colors.primaryDark },

  phoneSection: { gap: 8 },

  centeredState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  centeredStateText: { fontSize: 16, fontWeight: '600', color: Colors.textSecondary },

  pendingIconCircle: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
  },
  doneIconCircle: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
  },
  doneTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  doneSubtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  pendingInfoCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, overflow: 'hidden',
  },
  pendingInfoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderDivider,
  },
  pendingInfoLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  pendingInfoValue: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },

  pendingNote: {
    backgroundColor: Colors.lateBg, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  pendingNoteText: { fontSize: 13, color: Colors.late, lineHeight: 18 },

  doneSummaryCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, overflow: 'hidden',
  },
  doneSummaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderDivider,
  },
  doneSummaryLabel: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  doneSummaryValue: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  doneSummaryBalanceValue: { color: Colors.secondaryGreen },
});
