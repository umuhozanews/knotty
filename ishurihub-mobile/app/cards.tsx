import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, CreditCard, RefreshCw } from 'lucide-react-native';
import { Colors } from '../constants/theme';
import { ApiStudent, getStudents, issueStudentNfcCard, listStudentCards, SchoolCard, updateStudentCardStatus } from '../lib/api';
import { studentName } from '../lib/studentDisplay';
import { useAuth } from '../context/AuthContext';

export default function StudentCardsScreen() {
  const { user } = useAuth();
  const [students, setStudents] = useState<ApiStudent[]>([]);
  const [cards, setCards] = useState<SchoolCard[]>([]);
  const [selected, setSelected] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!user?.school_id) return;
    setLoading(true); setError('');
    try {
      const [roster, assignments] = await Promise.all([getStudents(user.school_id, '', 500), listStudentCards(user.school_id)]);
      setStudents(roster.students.filter((student) => student.is_active));
      setCards(assignments);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load card records.'); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const submit = async (action: 'issue' | 'suspend' | 'lost' | 'resume', card?: SchoolCard) => {
    if (!user?.school_id) return;
    if (action === 'issue' && (!selected || !identifier.trim())) { Alert.alert('Required', 'Select a student and enter the NFC UID.'); return; }
    if (action !== 'issue' && reason.trim().length < 3) { Alert.alert('Reason required', 'Enter at least 3 characters for the audit record.'); return; }
    setBusy(true);
    try {
      if (action === 'issue') await issueStudentNfcCard(user.school_id, selected, identifier);
      else if (card) await updateStudentCardStatus(user.school_id, card.card_assignment_id, action === 'resume' ? 'active' : action === 'suspend' ? 'suspended' : 'lost', reason);
      setIdentifier(''); setReason(''); await refresh();
      Alert.alert('Saved', action === 'issue' ? 'The student NFC card is active.' : 'The card status was updated.');
    } catch (cause) { Alert.alert('Could not update card', cause instanceof Error ? cause.message : 'Please try again.'); }
    finally { setBusy(false); }
  };

  const studentFor = (studentId: string | null) => students.find((student) => student.id === studentId);
  const unassigned = students.filter((student) => !cards.some((card) => card.student_id === student.id && ['active', 'issued'].includes(card.status)));

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}><ArrowLeft size={20} color={Colors.textPrimary}/></TouchableOpacity>
      <View style={{ flex: 1 }}><Text style={styles.title}>Student NFC cards</Text><Text style={styles.sub}>Issue and manage school cards</Text></View>
      <TouchableOpacity onPress={() => void refresh()} style={styles.back}><RefreshCw size={18} color={Colors.primary}/></TouchableOpacity>
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.notice}><Text style={styles.noticeText}>Enter the NFC UID from your registered card writer. UIDs are securely hashed by the server and are not stored in this app.</Text></View>
      <Text style={styles.section}>Issue a student card</Text>
      {unassigned.length === 0 ? <Text style={styles.helper}>No active students without a card.</Text> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.studentChoices}>
        {unassigned.map((student) => <TouchableOpacity key={student.id} onPress={() => setSelected(student.id)} style={[styles.choice, selected === student.id && styles.choiceSelected]}><Text numberOfLines={1} style={[styles.choiceText, selected === student.id && styles.choiceTextSelected]}>{studentName(student)}</Text></TouchableOpacity>)}
      </ScrollView>}
      <TextInput value={identifier} onChangeText={setIdentifier} autoCapitalize="characters" autoCorrect={false} placeholder="NFC UID" style={styles.input}/>
      <TouchableOpacity disabled={busy || !unassigned.length} onPress={() => void submit('issue')} style={[styles.primaryButton, (busy || !unassigned.length) && styles.disabled]}>
        {busy ? <ActivityIndicator color="white"/> : <><CreditCard size={17} color="white"/><Text style={styles.primaryText}>Issue and activate card</Text></>}
      </TouchableOpacity>
      <Text style={styles.section}>Issued cards</Text>
      {loading ? <ActivityIndicator color={Colors.primary}/> : error ? <Text style={styles.error}>{error}</Text> : cards.length === 0 ? <Text style={styles.helper}>No student cards found, or your account cannot read card records.</Text> : cards.map((card) => {
        const student = studentFor(card.student_id);
        return <View key={card.card_assignment_id} style={styles.cardRow}>
          <View style={styles.cardIcon}><CreditCard size={18} color={Colors.primary}/></View>
          <View style={{ flex: 1 }}><Text style={styles.cardName}>{student ? studentName(student) : 'Student record unavailable'}</Text><Text style={styles.cardStatus}>Status: {card.status}</Text></View>
          {card.status === 'active' ? <View style={{ alignItems: 'flex-end' }}><TouchableOpacity onPress={() => void submit('suspend', card)}><Text style={styles.action}>Suspend</Text></TouchableOpacity><TouchableOpacity onPress={() => void submit('lost', card)}><Text style={styles.action}>Mark lost</Text></TouchableOpacity></View> : card.status === 'suspended' ? <TouchableOpacity onPress={() => void submit('resume', card)}><Text style={styles.action}>Resume</Text></TouchableOpacity> : null}
        </View>;
      })}
      {cards.some((card) => card.status === 'active') && <><Text style={styles.helper}>To suspend or resume a card, provide the audit reason:</Text><TextInput value={reason} onChangeText={setReason} placeholder="Reason (required)" style={styles.input}/></>}
      <Text style={styles.footnote}>Physical NFC scanning requires a compatible reader registered with the school. This app manages card assignments; it does not pretend the phone has scanned a card.</Text>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: Colors.background }, header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderColor: Colors.border }, back: { width: 38, height: 40, alignItems: 'center', justifyContent: 'center' }, title: { color: Colors.textPrimary, fontSize: 19, fontWeight: '800' }, sub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 }, content: { padding: 16, gap: 12, paddingBottom: 40 }, notice: { padding: 13, borderRadius: 12, backgroundColor: Colors.primaryLight ?? '#EAF3F1' }, noticeText: { color: Colors.textPrimary, fontSize: 13, lineHeight: 19 }, section: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', marginTop: 6 }, studentChoices: { gap: 8 }, choice: { maxWidth: 220, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface }, choiceSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary }, choiceText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600' }, choiceTextSelected: { color: 'white' }, input: { minHeight: 48, borderWidth: 1, borderColor: Colors.border, borderRadius: 11, backgroundColor: Colors.surface, paddingHorizontal: 13, color: Colors.textPrimary }, primaryButton: { minHeight: 49, borderRadius: 12, backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, primaryText: { color: 'white', fontWeight: '700' }, disabled: { opacity: 0.55 }, helper: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 }, cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface }, cardIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#EAF3F1' }, cardName: { fontWeight: '700', color: Colors.textPrimary }, cardStatus: { color: Colors.textSecondary, fontSize: 12, marginTop: 3 }, action: { color: Colors.primary, fontWeight: '700', padding: 6 }, error: { color: Colors.absent }, footnote: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 8 } });
