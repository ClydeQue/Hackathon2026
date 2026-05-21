import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ItemCategory, ItemCondition } from '@/types';

const INK  = '#0F1117';
const CREAM = '#EEF4FB';
const PAPER = '#DCEAF6';
const LIME  = '#F4FF61';
const CORAL = '#FF5C4D';

const CATEGORIES: ItemCategory[] = ['top', 'bottom', 'outerwear', 'dress', 'other'];
const CONDITIONS: ItemCondition[] = ['damaged', 'used', 'barely_used', 'good', 'brand_new'];
const CONDITION_LABEL: Record<ItemCondition, string> = {
  damaged: 'damaged', used: 'used', barely_used: 'barely used',
  good: 'good', brand_new: 'brand new',
};

export type TagEditorValue = {
  category: ItemCategory;
  color: string;
  material: string;
  brand: string;
  condition: ItemCondition;
};

export type TagEditorErrors = Partial<Record<keyof TagEditorValue, string>>;

type Props = {
  value: TagEditorValue;
  onChange: (next: TagEditorValue) => void;
  errors?: TagEditorErrors;
};

function FieldLabel({ children, required }: { children: string; required?: boolean }) {
  return (
    <Text style={s.label}>
      {children}
      {required ? <Text style={s.req}> *</Text> : null}
    </Text>
  );
}

export function TagEditor({ value, onChange, errors }: Props) {
  return (
    <View style={s.wrap}>
      <FieldLabel required>Category</FieldLabel>
      <View style={s.chips}>
        {CATEGORIES.map((c) => {
          const on = value.category === c;
          return (
            <Pressable
              key={c}
              onPress={() => onChange({ ...value, category: c })}
              style={[s.chip, on && s.chipOn]}
            >
              <Text style={[s.chipText, on && s.chipTextOn]}>{c}</Text>
            </Pressable>
          );
        })}
      </View>
      {errors?.category ? <Text style={s.error}>{errors.category}</Text> : null}

      <FieldLabel required>Color</FieldLabel>
      <TextInput
        style={[s.input, errors?.color && s.inputError]}
        value={value.color}
        onChangeText={(t) => onChange({ ...value, color: t })}
        placeholder="e.g. navy, cream, rust"
        placeholderTextColor={`${INK}66`}
        autoCapitalize="none"
      />
      {errors?.color ? <Text style={s.error}>{errors.color}</Text> : null}

      <FieldLabel required>Material</FieldLabel>
      <TextInput
        style={[s.input, errors?.material && s.inputError]}
        value={value.material}
        onChangeText={(t) => onChange({ ...value, material: t })}
        placeholder="e.g. cotton, wool"
        placeholderTextColor={`${INK}66`}
        autoCapitalize="none"
      />
      {errors?.material ? <Text style={s.error}>{errors.material}</Text> : null}

      <FieldLabel>Brand</FieldLabel>
      <TextInput
        style={s.input}
        value={value.brand}
        onChangeText={(t) => onChange({ ...value, brand: t })}
        placeholder="optional"
        placeholderTextColor={`${INK}66`}
      />

      <FieldLabel required>Condition</FieldLabel>
      <View style={s.chips}>
        {CONDITIONS.map((c) => {
          const on = value.condition === c;
          return (
            <Pressable
              key={c}
              onPress={() => onChange({ ...value, condition: c })}
              style={[s.chip, on && s.chipOn]}
            >
              <Text style={[s.chipText, on && s.chipTextOn]}>{CONDITION_LABEL[c]}</Text>
            </Pressable>
          );
        })}
      </View>
      {errors?.condition ? <Text style={s.error}>{errors.condition}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 8 },
  label: {
    fontFamily: 'WorkSans',
    fontWeight: '700',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    color: INK,
    marginTop: 10,
    opacity: 0.75,
  },
  req: { color: CORAL },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: PAPER,
    borderWidth: 2,
    borderColor: INK,
  },
  chipOn: {
    backgroundColor: INK,
    shadowColor: INK,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  chipText: {
    color: INK,
    fontFamily: 'WorkSans',
    fontWeight: '700',
    fontSize: 11,
    textTransform: 'capitalize',
    letterSpacing: 0.3,
  },
  chipTextOn: { color: LIME },
  input: {
    borderWidth: 3,
    borderColor: INK,
    backgroundColor: CREAM,
    padding: 12,
    fontFamily: 'WorkSans',
    fontWeight: '600',
    fontSize: 15,
    color: INK,
    shadowColor: INK,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  inputError: { borderColor: CORAL },
  error: {
    color: CORAL,
    fontFamily: 'WorkSans',
    fontWeight: '700',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: -2,
  },
});
