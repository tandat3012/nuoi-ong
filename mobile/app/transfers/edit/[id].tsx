import { useLocalSearchParams } from 'expo-router';
import InventoryActionScreen from '@/src/features/inventory/presentation/InventoryActionScreen';

export default function TransferEditRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <InventoryActionScreen mode="transfer" editId={id} />;
}
