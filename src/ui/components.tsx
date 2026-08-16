/** Shared building blocks. No UI library in this build — these are it. */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { CREAM, FAINT, INK, LIME, LINE, MUTED, PANEL, SUNK, TAP } from './theme';

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={s.card}>
      {title !== undefined && <Text style={s.cardTitle}>{title}</Text>}
      {children}
    </View>
  );
}

export function Field({
  label,
  hint,
  value,
  placeholder,
  onChangeText,
}: {
  label: string;
  hint?: string;
  value: string;
  placeholder?: string;
  onChangeText: (t: string) => void;
}) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={s.input}
        value={value}
        placeholder={placeholder}
        placeholderTextColor={FAINT}
        onChangeText={onChangeText}
      />
      {hint !== undefined && <Text style={s.fieldHint}>{hint}</Text>}
    </View>
  );
}

export function Primary({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[s.primary, disabled === true && s.disabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={s.primaryText}>{label}</Text>
    </Pressable>
  );
}

export function Big({
  label,
  sub,
  onPress,
  disabled,
  selected,
}: {
  label: string;
  sub?: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
}) {
  return (
    <Pressable
      style={[s.big, selected === true && s.selected, disabled === true && s.disabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={s.bigText}>{label}</Text>
      {sub !== undefined && <Text style={s.bigSub}>{sub}</Text>}
    </Pressable>
  );
}

/** Compact pill, for dismissal kinds and player lists. */
export function Pill({
  label,
  onPress,
  disabled,
  selected,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
}) {
  return (
    <Pressable
      style={[s.pill, selected === true && s.selected, disabled === true && s.disabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={s.pillText}>{label}</Text>
    </Pressable>
  );
}

export function Choice({
  label,
  sub,
  selected,
  onPress,
}: {
  label: string;
  sub: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[s.choice, selected && s.selected]} onPress={onPress}>
      <Text style={s.choiceText}>{label}</Text>
      <Text style={s.choiceSub}>{sub}</Text>
    </Pressable>
  );
}

export function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <View style={s.kv}>
      <Text style={s.k}>{k}</Text>
      <Text style={[s.vv, mono === true && s.mono]} numberOfLines={2}>
        {v}
      </Text>
    </View>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <Text style={s.note}>{children}</Text>;
}

export const s = StyleSheet.create({
  card: {
    backgroundColor: PANEL,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: LINE,
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: { color: CREAM, fontSize: 16, fontWeight: '700', marginBottom: 12 },

  row: { flexDirection: 'row', gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  field: { marginBottom: 12 },
  fieldLabel: { color: MUTED, fontSize: 12, marginBottom: 6 },
  fieldHint: { color: FAINT, fontSize: 11, marginTop: 4 },
  input: {
    minHeight: TAP,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 10,
    paddingHorizontal: 14,
    color: CREAM,
    fontSize: 16,
    backgroundColor: SUNK,
  },

  primary: {
    minHeight: 56,
    borderRadius: 12,
    backgroundColor: LIME,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryText: { color: INK, fontSize: 17, fontWeight: '800' },

  big: {
    flex: 1,
    minHeight: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: SUNK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigText: { color: CREAM, fontSize: 18, fontWeight: '700' },
  bigSub: { color: MUTED, fontSize: 11, marginTop: 2 },

  pill: {
    minHeight: TAP,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: SUNK,
  },
  pillText: { color: CREAM, fontSize: 14, fontWeight: '600' },

  choice: {
    flex: 1,
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LINE,
    padding: 12,
    justifyContent: 'center',
  },
  choiceText: { color: CREAM, fontWeight: '700', fontSize: 15 },
  choiceSub: { color: MUTED, fontSize: 11, marginTop: 2 },

  selected: { borderColor: LIME, backgroundColor: '#16301f' },
  disabled: { opacity: 0.3 },

  kv: { flexDirection: 'row', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: LINE },
  k: { color: MUTED, fontSize: 13, width: 110 },
  vv: { color: CREAM, fontSize: 13, flex: 1 },
  mono: { fontSize: 10, color: '#9fb8aa' },

  note: { color: MUTED, fontSize: 13, lineHeight: 19, marginTop: 10 },
});
