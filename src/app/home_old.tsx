import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function Home() {
  const [message, setMessage] = useState('Завантаження...');

  useEffect(() => {
    supabase
      .from('hello')
      .select('message')
      .eq('id', 1)
      .single()
      .then(({ data, error }) => {
        setMessage(error ? `Помилка: ${error.message}` : data.message);
      });
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Добрий день, шановні</Text>
      <Text style={styles.subtitle}>Сьогодні 13 жовтня</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 80,
    gap: 12 
  },
  title: { fontSize: 28, fontWeight: 'bold' },
  subtitle: {fontSize: 16}
});