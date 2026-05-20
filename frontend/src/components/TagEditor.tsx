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

type Props = {
  value: TagEditorValue;
  onChange: (next: TagEditorValue) => void;
};

export function TagEditor({ value, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Category</Text>
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

      <Text style={styles.label}>Color</Text>
      <TextInput
        style={styles.input}
        value={value.color}
        onChangeText={(t) => onChange({ ...value, color: t })}
        placeholder="e.g. navy, cream, rust"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Material</Text>
      <TextInput
        style={styles.input}
        value={value.material}
        onChangeText={(t) => onChange({ ...value, material: t })}
        placeholder="e.g. cotton, wool"
        autoCapitalize="none"
      />

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
});
