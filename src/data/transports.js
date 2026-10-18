export const transports = [
  { id: 'walk', label: 'Пешком', icon: 'user' },
  { id: 'taxi', label: 'Такси', icon: 'navigation' },
  { id: 'car', label: 'Машина', icon: 'truck' },
  { id: 'bus', label: 'Автобус', icon: 'map' },
];
export const transportLabel = id => transports.find(item => item.id === id)?.label || 'Пешком';
