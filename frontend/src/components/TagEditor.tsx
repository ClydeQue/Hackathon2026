import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { ItemCategory } from '@/types';

const CATEGORIES: ItemCategory[] = [
  'top',
  'bottom',
  'outerwear',
  'shoes',
  'accessory',
  'dress',
  'other',
];

export type TagEditorValue = {
  category: ItemCategory;
  color: string;
  material: string;
  brand: string;
};

export type TagEditorErrors = Partial<Record<keyof TagEditorValue, string>>;

type Props = {
  value: TagEditorValue;
  onChange: (next: TagEditorValue) => void;
  errors?: TagEditorErrors;
};

function RequiredLabel({ children }: { children: string }) {
  return (
    <Text style={styles.label}>
      {children} <Text style={styles.required}>*</Text>
    </Text>
  );
}

export function TagEditor({ value, onChange, errors }: Props) {
  return (
    <View style={styles.wrap}>
      <RequiredLabel>Category</RequiredLabel>
      <View style={styles.chips}>
        {CATEGORIES.map((c) => {
          const selected = value.category === c;
          return (
            <Text
              key={c}
              onPress={() => onChange({ ...value, category: c })}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              {c}
            </Text>
          );
        })}
      </View>
      {errors?.category ? <Text style={styles.error}>{errors.category}</Text> : null}

      <RequiredLabel>Color</RequiredLabel>
      <TextInput
        style={[styles.input, errors?.color && styles.inputError]}
        value={value.color}
        onChangeText={(t) => onChange({ ...value, color: t })}
        placeholder="e.g. navy, cream, rust"
        autoCapitalize="none"
      />
      {errors?.color ? <Text style={styles.error}>{errors.color}</Text> : null}

      <RequiredLabel>Material</RequiredLabel>
      <TextInput
        style={[styles.input, errors?.material && styles.inputError]}
        value={value.material}
        onChangeText={(t) => onChange({ ...value, material: t })}
        placeholder="e.g. cotton, wool"
        autoCapitalize="none"
      />
      {errors?.material ? <Text style={styles.error}>{errors.material}</Text> : null}

      <Text style={styles.label}>Brand</Text>
      <TextInput
        style={styles.input}
        value={value.brand}
        onChangeText={(t) => onChange({ ...value, brand: t })}
        placeholder="optional"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontWeight: '600', marginTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#eee',
    color: '#333',
    overflow: 'hidden',
    textTransform: 'capitalize',
  },
  chipSelected: { backgroundColor: '#111', color: '#fff' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
  },
  inputError: { borderColor: '#c00' },
  required: { color: '#c00' },
  error: { color: '#c00', fontSize: 13, marginTop: -4 },
});
